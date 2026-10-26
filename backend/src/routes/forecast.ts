import express from "express";
import type { Request } from "express";
import https from "https";
import prisma from "../prisma.js";

const router = express.Router();

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function hasForecastAccess(req: Request): boolean {
  return (
    req.account.ruoloGlobale === "Amministratore" ||
    req.account.accessi["revenueForecast"]?.abilitato === true
  );
}

// Le BU del forecast sono le sedi dell'app Utenti con una BU di Business Central associata.
async function syncBuDaSedi(): Promise<void> {
  const sedi = await prisma.utentiSede.findMany({ where: { buCodice: { not: null } } });
  const ids: string[] = [];
  for (const s of sedi) {
    const id = `FBU-${s.id}`;
    ids.push(id);
    // L'attivazione per il forecast è una scelta in Impostazioni: una sede nuova parte disattivata.
    await prisma.forecastBU.upsert({
      where: { id },
      create: { id, nome: s.nome, codiceBC: s.buCodice, sedeCentraleId: s.id, attiva: false },
      update: { nome: s.nome, codiceBC: s.buCodice, sedeCentraleId: s.id, ...(s.attiva ? {} : { attiva: false }) },
    });
  }
  await prisma.forecastBU.updateMany({ where: { id: { notIn: ids } }, data: { attiva: false } });
}

async function allowedBuIds(req: Request): Promise<string[] | null> {
  if (req.account.ruoloGlobale === "Amministratore") return null;
  const sedi = req.account.sediAbilitate;
  if (!sedi) return null;
  if (sedi.length === 0) return [];
  const bus = await prisma.forecastBU.findMany({
    where: { sedeCentraleId: { in: sedi }, attiva: true },
    select: { id: true },
  });
  return bus.map((b) => b.id);
}

// ─── BU ─────────────────────────────────────────────────────────────────────

router.get("/bu", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    await syncBuDaSedi();
    const buIds = await allowedBuIds(req);
    const soloAttive = req.query.tutte !== "1";
    const where = {
      ...(buIds ? { id: { in: buIds } } : {}),
      ...(soloAttive ? { attiva: true } : {}),
    };
    const bus = await prisma.forecastBU.findMany({ where, orderBy: { nome: "asc" }, include: { voci: { select: { voceId: true } } } });
    // never expose Mews tokens to the client
    res.json(bus.map(({ mewsClientToken: _c, mewsAccessToken: _a, voci, ...b }) => ({ ...b, voceIds: voci.map((v) => v.voceId) })));
  } catch (e) { next(e); }
});

router.post("/bu", async (req, res, next) => {
  try {
    const { nome, codiceBC, sedeCentraleId, mewsPropertyId, mewsClientToken, mewsAccessToken } = req.body;
    const bu = await prisma.forecastBU.create({
      data: {
        id: uid("FBU"),
        nome,
        codiceBC: codiceBC || null,
        sedeCentraleId,
        mewsPropertyId: mewsPropertyId || null,
        mewsClientToken: mewsClientToken || null,
        mewsAccessToken: mewsAccessToken || null,
        attiva: true,
      },
    });
    const { mewsClientToken: _c, mewsAccessToken: _a, ...safe } = bu;
    res.json(safe);
  } catch (e) { next(e); }
});

router.put("/bu/:id", async (req, res, next) => {
  try {
    const { nome, codiceBC, sedeCentraleId, mewsPropertyId, mewsClientToken, mewsAccessToken, attiva } = req.body;
    const patch: Record<string, unknown> = {
      nome, codiceBC: codiceBC || null, sedeCentraleId,
      mewsPropertyId: mewsPropertyId || null, attiva: attiva ?? true,
    };
    // update tokens only when explicitly supplied (non-empty string)
    if (mewsClientToken !== undefined && mewsClientToken !== "") patch.mewsClientToken = mewsClientToken;
    if (mewsAccessToken !== undefined && mewsAccessToken !== "") patch.mewsAccessToken = mewsAccessToken;
    const bu = await prisma.forecastBU.update({ where: { id: req.params.id }, data: patch });
    const { mewsClientToken: _c, mewsAccessToken: _a, ...safe } = bu;
    res.json(safe);
  } catch (e) { next(e); }
});

router.put("/bu/:id/attiva", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.status(403).json({ error: "Accesso negato" }); return; }
    const bu = await prisma.forecastBU.update({ where: { id: req.params.id }, data: { attiva: req.body.attiva === true } });
    const { mewsClientToken: _c, mewsAccessToken: _a, ...safe } = bu;
    res.json(safe);
  } catch (e) { next(e); }
});

// ─── VOCI ────────────────────────────────────────────────────────────────────

const eMarcatore = (nome: string) => /\s-\s(Inizio|Fine)$/.test(nome);

// Le voci di ricavo sono i tipi attività di Business Central (escluse le righe "Inizio"/"Fine" dei gruppi).
async function syncVociDaTipiAttivita(): Promise<void> {
  const tipi = await prisma.forecastBCTipoAttivita.findMany({ orderBy: { codice: "asc" } });
  let ordine = 0;
  for (const t of tipi) {
    if (eMarcatore(t.nome)) continue;
    ordine += 1;
    await prisma.forecastVoce.upsert({
      where: { id: `FVO-${t.codice}` },
      create: { id: `FVO-${t.codice}`, nome: t.nome, ordine, attiva: true },
      update: { nome: t.nome, ordine },
    });
  }
}

router.put("/bu/:id/attiva", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.status(403).json({ error: "Accesso negato" }); return; }
    const bu = await prisma.forecastBU.update({ where: { id: req.params.id }, data: { attiva: req.body.attiva === true } });
    const { mewsClientToken: _c, mewsAccessToken: _a, ...safe } = bu;
    res.json(safe);
  } catch (e) { next(e); }
});

router.put("/bu/:id/voci", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.status(403).json({ error: "Accesso negato" }); return; }
    await syncVociDaTipiAttivita();
    const voceIds = [...new Set((req.body.voceIds as string[]) || [])];
    await prisma.$transaction([
      prisma.forecastBuVoce.deleteMany({ where: { buId: req.params.id } }),
      prisma.forecastBuVoce.createMany({ data: voceIds.map((voceId) => ({ id: uid("FBV"), buId: req.params.id, voceId })) }),
    ]);
    res.json({ voceIds });
  } catch (e) { next(e); }
});

router.get("/voci", async (req, res, next) => {
  try {
    await syncVociDaTipiAttivita();
    res.json(await prisma.forecastVoce.findMany({ orderBy: { ordine: "asc" } }));
  } catch (e) { next(e); }
});

router.get("/tipi-attivita", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    res.json(await prisma.forecastBCTipoAttivita.findMany({ orderBy: { codice: "asc" } }));
  } catch (e) { next(e); }
});

// ─── ENTRIES ─────────────────────────────────────────────────────────────────

router.get("/entries", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    const { buId, anno, mese } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (buId) where.buId = buId;
    if (anno) where.anno = parseInt(anno);
    if (mese) where.mese = parseInt(mese);
    const entries = await prisma.forecastEntry.findMany({ where });
    res.json(entries.map((e) => ({ ...e, importo: Number(e.importo) })));
  } catch (e) { next(e); }
});

// batch upsert as draft
router.put("/entries", async (req, res, next) => {
  try {
    const { entries, utenteId } = req.body as {
      entries: Array<{ buId: string; anno: number; mese: number; voceId: string; importo: number }>;
      utenteId: string;
    };
    const now = new Date();
    const results = [];
    for (const { buId, anno, mese, voceId, importo } of entries) {
      const upserted = await prisma.forecastEntry.upsert({
        where: { buId_anno_mese_voceId: { buId, anno, mese, voceId } },
        create: { id: uid("FEN"), buId, anno, mese, voceId, importo, stato: "bozza", dataModifica: now, utenteId },
        update: { importo, stato: "bozza", dataModifica: now, utenteId },
      });
      await prisma.forecastStorico.create({
        data: {
          id: uid("FST"),
          buId, anno, mese, voceId, importo,
          dataRegistrazione: now, utenteId, tipo: "modifica",
        },
      });
      results.push(upserted);
    }
    res.json(results.map((e) => ({ ...e, importo: Number(e.importo) })));
  } catch (e) { next(e); }
});

// publish all entries for a BU/month
router.post("/entries/pubblica", async (req, res, next) => {
  try {
    const { buId, anno, mese, utenteId } = req.body as {
      buId: string; anno: number; mese: number; utenteId: string;
    };
    const now = new Date();
    const existing = await prisma.forecastEntry.findMany({ where: { buId, anno, mese } });
    await prisma.forecastEntry.updateMany({
      where: { buId, anno, mese },
      data: { stato: "pubblicato", dataModifica: now, utenteId },
    });
    for (const e of existing) {
      await prisma.forecastStorico.create({
        data: {
          id: uid("FST"),
          buId, anno, mese,
          voceId: e.voceId,
          importo: e.importo,
          dataRegistrazione: now,
          utenteId,
          tipo: "pubblicazione",
        },
      });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── TARGETS ─────────────────────────────────────────────────────────────────

router.get("/targets", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    const { buId, anno } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (buId) where.buId = buId;
    if (anno) where.anno = parseInt(anno);
    const targets = await prisma.forecastTarget.findMany({ where });
    res.json(targets.map((t) => ({ ...t, importo: Number(t.importo) })));
  } catch (e) { next(e); }
});

router.put("/targets", async (req, res, next) => {
  try {
    const { targets } = req.body as {
      targets: Array<{ buId: string; anno: number; mese: number; voceId: string; importo: number }>;
    };
    const results = [];
    for (const { buId, anno, mese, voceId, importo } of targets) {
      const upserted = await prisma.forecastTarget.upsert({
        where: { buId_anno_mese_voceId: { buId, anno, mese, voceId } },
        create: { id: uid("FTG"), buId, anno, mese, voceId, importo },
        update: { importo },
      });
      results.push(upserted);
    }
    res.json(results.map((t) => ({ ...t, importo: Number(t.importo) })));
  } catch (e) { next(e); }
});

// ─── STORICO ─────────────────────────────────────────────────────────────────

router.get("/storico", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    const { buId, anno, mese } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (buId) where.buId = buId;
    if (anno) where.anno = parseInt(anno);
    if (mese) where.mese = parseInt(mese);
    const storici = await prisma.forecastStorico.findMany({
      where,
      orderBy: { dataRegistrazione: "asc" },
    });
    res.json(storici.map((s) => ({ ...s, importo: Number(s.importo) })));
  } catch (e) { next(e); }
});

// ─── ACTUALS (Mews cache) ─────────────────────────────────────────────────────

router.get("/actuals", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    const { buId, anno, mese } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (buId) where.buId = buId;
    if (anno) where.anno = parseInt(anno);
    if (mese) where.mese = parseInt(mese);
    const actuals = await prisma.forecastActual.findMany({ where });
    res.json(actuals.map((a) => ({ ...a, importo: Number(a.importo) })));
  } catch (e) { next(e); }
});

router.post("/actuals/refresh", async (req, res, next) => {
  try {
    const { buId, anno, mese } = req.body as { buId: string; anno: number; mese: number };
    const bu = await prisma.forecastBU.findUnique({ where: { id: buId } });
    if (!bu?.mewsClientToken || !bu?.mewsAccessToken) {
      res.status(400).json({ error: "BU non configurata per Mews (token mancanti)" });
      return;
    }
    const startUtc = new Date(anno, mese - 1, 1).toISOString();
    const endUtc   = new Date(anno, mese, 0, 23, 59, 59).toISOString();
    const mewsRevenue = await callMewsRevenue(bu.mewsClientToken, bu.mewsAccessToken, startUtc, endUtc);
    const voci = await prisma.forecastVoce.findMany({ where: { attiva: true } });
    const now = new Date();
    for (const voce of voci) {
      const importo = mewsRevenue[voce.nome] ?? 0;
      await prisma.forecastActual.upsert({
        where: { buId_anno_mese_voceId: { buId, anno, mese, voceId: voce.id } },
        create: { id: uid("FAC"), buId, anno, mese, voceId: voce.id, importo, dataAggiornamento: now },
        update: { importo, dataAggiornamento: now },
      });
    }
    const actuals = await prisma.forecastActual.findMany({ where: { buId, anno, mese } });
    res.json(actuals.map((a) => ({ ...a, importo: Number(a.importo) })));
  } catch (e) { next(e); }
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

router.get("/dashboard", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json(null); return; }
    const buIds = await allowedBuIds(req);
    const { buId, anno } = req.query as Record<string, string | undefined>;
    const annoNum = parseInt(anno || String(new Date().getFullYear()));

    let filterIds: string[] | null = buIds;
    if (buId) {
      if (filterIds && !filterIds.includes(buId)) {
        res.json({ entries: [], targets: [], actuals: [] }); return;
      }
      filterIds = [buId];
    }

    const buWhere = filterIds ? { id: { in: filterIds }, attiva: true } : { attiva: true };
    const buList = await prisma.forecastBU.findMany({ where: buWhere, select: { id: true } });
    const ids = buList.map((b) => b.id);
    if (ids.length === 0) { res.json({ entries: [], targets: [], actuals: [] }); return; }

    const [entries, targets, actuals] = await Promise.all([
      prisma.forecastEntry.findMany({ where: { buId: { in: ids }, anno: annoNum } }),
      prisma.forecastTarget.findMany({ where: { buId: { in: ids }, anno: annoNum } }),
      prisma.forecastActual.findMany({ where: { buId: { in: ids }, anno: annoNum } }),
    ]);

    res.json({
      entries: entries.map((e) => ({ ...e, importo: Number(e.importo) })),
      targets: targets.map((t) => ({ ...t, importo: Number(t.importo) })),
      actuals: actuals.map((a) => ({ ...a, importo: Number(a.importo) })),
    });
  } catch (e) { next(e); }
});

// ─── MEWS helper ──────────────────────────────────────────────────────────────

async function callMewsRevenue(
  clientToken: string,
  accessToken: string,
  startUtc: string,
  endUtc: string,
): Promise<Record<string, number>> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      ClientToken: clientToken,
      AccessToken: accessToken,
      StartUtc: startUtc,
      EndUtc: endUtc,
      TimeFilter: "Consumed",
    });
    const options = {
      hostname: "api.mews.com",
      path: "/api/connector/v1/accountingItems/getAll",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          const revenue: Record<string, number> = {};
          for (const item of json.AccountingItems ?? []) {
            const svc = (item.ServiceName as string | undefined) ?? "";
            const cat = mapMewsCategory(svc);
            revenue[cat] = (revenue[cat] ?? 0) + (Number(item.Amount?.GrossValue) || 0);
          }
          resolve(revenue);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function mapMewsCategory(serviceName: string): string {
  const s = serviceName.toLowerCase();
  if (s.includes("accommodation") || s.includes("alloggio") || s.includes("camera") || s.includes("room")) {
    return "Accommodation";
  }
  if (s.includes("food") || s.includes("beverage") || s.includes("ristoran") || s.includes("bar") || s.includes("ristorazione")) {
    return "Food & Beverage";
  }
  if (s.includes("spa") || s.includes("wellness") || s.includes("fitness")) {
    return "Spa & Wellness";
  }
  return "Altri Ricavi";
}

export default router;
