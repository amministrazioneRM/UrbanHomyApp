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

// Access token Mews di una BU: variabile .env con il codice BU nel nome
// (es. BU 30.004 -> MEWS_ACCESS_TOKEN_30_004).
const mewsEnvName = (codice?: string | null) => (codice ? `MEWS_ACCESS_TOKEN_${codice.replace(/[^A-Za-z0-9]/g, "_")}` : "");
const mewsAccessTokenDi = (bu: { codiceBC?: string | null } | null): string | undefined => {
  if (!bu) return undefined;
  const nome = mewsEnvName(bu.codiceBC);
  return (nome ? process.env[nome] : undefined) || undefined;
};

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
    res.json(bus.map(({ mewsClientToken: _c, mewsAccessToken: _a, voci, ...b }) => ({
      ...b,
      voceIds: voci.map((v) => v.voceId),
      mewsConfigurato: !!mewsAccessTokenDi({ codiceBC: b.codiceBC }),
      mewsVariabile: mewsEnvName(b.codiceBC),
    })));
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

const VOCE_SENZA_TIPO = "FVO-SENZA-TIPO";

// Tipo attività di riserva per classificazione Mews, usato quando in BC la categoria non ha il Codice attività.
const CLASSIFICAZIONI_DEFAULT: Record<string, string> = {
  Accommodation: "1.1.01",
  FoodAndBeverage: "1.1.02",
  Events: "1.1.04",
  SundryIncome: "1.1.05",
  Facilities: "1.2.01",
};

async function mappaClassificazioni(): Promise<Record<string, string>> {
  for (const [classificazione, codiceAttivita] of Object.entries(CLASSIFICAZIONI_DEFAULT)) {
    await prisma.forecastMewsClassificazione.upsert({ where: { classificazione }, create: { classificazione, codiceAttivita }, update: {} });
  }
  const righe = await prisma.forecastMewsClassificazione.findMany();
  return Object.fromEntries(righe.map((r) => [r.classificazione, r.codiceAttivita]));
}

router.get("/mews/classificazioni", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.json([]); return; }
    const mappa = await mappaClassificazioni();
    res.json(Object.entries(mappa).map(([classificazione, codiceAttivita]) => ({ classificazione, codiceAttivita })));
  } catch (e) { next(e); }
});

router.put("/mews/classificazioni/:classificazione", async (req, res, next) => {
  try {
    if (!hasForecastAccess(req)) { res.status(403).json({ error: "Accesso negato" }); return; }
    const { classificazione } = req.params;
    const codiceAttivita = String(req.body.codiceAttivita || "");
    if (!codiceAttivita) { res.status(400).json({ error: "Tipo attività mancante" }); return; }
    await prisma.forecastMewsClassificazione.upsert({ where: { classificazione }, create: { classificazione, codiceAttivita }, update: { codiceAttivita } });
    res.json({ classificazione, codiceAttivita });
  } catch (e) { next(e); }
});

// Produzione del mese da Mews, sommata per tipo attività: ogni categoria contabile Mews è collegata a un codice attività
// nella tabella BC "BKMEWS Category" (importata in forecast_mews_categorie). Le tasse non sono produzione e si escludono;
// le categorie senza codice attività finiscono nella voce "Senza tipo attività".
router.post("/actuals/refresh", async (req, res, next) => {
  try {
    if (req.account.ruoloGlobale !== "Amministratore") { res.status(403).json({ error: "Solo un amministratore può aggiornare i dati da Mews" }); return; }
    const { buId, anno, mese } = req.body as { buId: string; anno: number; mese: number };
    const bu = await prisma.forecastBU.findUnique({ where: { id: buId } });
    const clientToken = process.env.MEWS_CLIENT_TOKEN;
    const accessToken = mewsAccessTokenDi(bu);
    if (!clientToken || !accessToken) {
      res.status(400).json({ error: `Credenziali Mews mancanti: imposta MEWS_CLIENT_TOKEN e ${mewsEnvName(bu?.codiceBC) || "MEWS_ACCESS_TOKEN_<codice BU>"} nel file .env` });
      return;
    }

    const nettoPerCategoria = await callMewsOrderItems(clientToken, accessToken, inizioMeseRomaUtc(anno, mese - 1), inizioMeseRomaUtc(anno, mese));
    await syncVociDaTipiAttivita();
    await prisma.forecastVoce.upsert({
      where: { id: VOCE_SENZA_TIPO },
      create: { id: VOCE_SENZA_TIPO, nome: "Senza tipo attività", ordine: 9999, attiva: true },
      update: {},
    });

    const [categorie, voci] = await Promise.all([prisma.forecastMewsCategoria.findMany(), prisma.forecastVoce.findMany({ select: { id: true } })]);
    const categoria = new Map(categorie.map((c) => [c.mewsId, c]));
    const perClassificazione = await mappaClassificazioni();
    const vociEsistenti = new Set(voci.map((v) => v.id));
    const perVoce: Record<string, number> = {};
    for (const [mewsId, importo] of Object.entries(nettoPerCategoria)) {
      const c = categoria.get(mewsId);
      if (c?.classificazione === "Taxes") continue;
      const codice = c?.codiceAttivita || (c?.classificazione ? perClassificazione[c.classificazione] : undefined);
      const voceId = codice && vociEsistenti.has(`FVO-${codice}`) ? `FVO-${codice}` : VOCE_SENZA_TIPO;
      perVoce[voceId] = (perVoce[voceId] ?? 0) + importo;
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.forecastActual.deleteMany({ where: { buId, anno, mese } }),
      prisma.forecastActual.createMany({
        data: Object.entries(perVoce).map(([voceId, importo]) => ({ id: uid("FAC"), buId, anno, mese, voceId, importo: Math.round(importo * 100) / 100, dataAggiornamento: now })),
      }),
    ]);
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

// Mezzanotte locale (Europe/Rome) del primo giorno del mese (mese0 = 0..12), espressa in UTC.
function inizioMeseRomaUtc(anno: number, mese0: number): string {
  const ipotesi = Date.UTC(anno, mese0, 1, 0, 0, 0);
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ipotesi));
  const n = (t: string) => Number(parti.find((p) => p.type === t)?.value);
  const comeLocale = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
  return new Date(ipotesi - (comeLocale - ipotesi)).toISOString();
}

function mewsPost(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname: "api.mews.com", path: `/api/connector/v1/${path}`, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          try { resolve({ status: res.statusCode ?? 0, json: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode ?? 0, json: { Message: raw.slice(0, 200) } }); }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// Netto (Amount.NetValue) dei consumi del periodo, per categoria contabile Mews (orderItems/getAll, con paginazione).
async function callMewsOrderItems(clientToken: string, accessToken: string, startUtc: string, endUtc: string): Promise<Record<string, number>> {
  const netto: Record<string, number> = {};
  const PAGINA = 1000;
  let cursor: string | undefined;
  do {
    const { status, json } = await mewsPost("orderItems/getAll", {
      ClientToken: clientToken,
      AccessToken: accessToken,
      Client: "UrbanHomy-RevenueForecast 1.0",
      ConsumedUtc: { StartUtc: startUtc, EndUtc: endUtc },
      AccountingStates: ["Open", "Closed"],
      Limitation: { Count: PAGINA, ...(cursor ? { Cursor: cursor } : {}) },
    });
    if (status !== 200) throw new Error(`Mews ha risposto ${status}: ${(json.Message as string) || "errore"}`);
    const items = (json.OrderItems as Array<{ AccountingCategoryId?: string | null; Amount?: { NetValue?: number } }>) ?? [];
    for (const it of items) {
      const k = it.AccountingCategoryId || "(nessuna)";
      netto[k] = (netto[k] ?? 0) + (it.Amount?.NetValue ?? 0);
    }
    cursor = items.length === PAGINA ? (json.Cursor as string | undefined) : undefined;
  } while (cursor);
  return netto;
}

export default router;
