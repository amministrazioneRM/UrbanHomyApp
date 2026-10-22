import "dotenv/config";
import express from "express";
import type { Request } from "express";
import cors from "cors";
import prisma from "./prisma.js";
import { makeCrudRouter } from "./routes/crud.js";
import { Prisma } from "@prisma/client";
import { requireAuth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import type { AppId } from "./types.js";

// null = tutte le sedi (nessun filtro); string[] = solo quelle sedi ([] = nessuna)
function allowedSedi(req: Request): string[] | null {
  const { ruoloGlobale, sediAbilitate } = req.account;
  if (ruoloGlobale === "Amministratore") return null;
  if (sediAbilitate == null) return null; // null/undefined = tutte le sedi
  return sediAbilitate; // [] = nessuna sede; [...] = solo quelle
}

const NO_RESULTS = { id: { in: [] as string[] } };

function hasAppAccess(req: Request, appId: AppId): boolean {
  return req.account.accessi[appId]?.abilitato === true ||
    req.account.ruoloGlobale === "Amministratore";
}

function struttureFilter(appId: AppId) {
  return (req: Request) => {
    if (!hasAppAccess(req, appId)) return NO_RESULTS;
    const sedi = allowedSedi(req);
    if (!sedi) return undefined; // tutte le sedi
    if (sedi.length === 0) return NO_RESULTS; // nessuna sede abilitata
    return { sedeCentraleId: { in: sedi } };
  };
}

function lockerChildFilter(appId: AppId) {
  return async (req: Request) => {
    if (!hasAppAccess(req, appId)) return NO_RESULTS;
    const sedi = allowedSedi(req);
    if (!sedi) return undefined; // tutte le sedi
    if (sedi.length === 0) return NO_RESULTS; // nessuna sede abilitata
    const strutture = await prisma.lockerStruttura.findMany({
      where: { sedeCentraleId: { in: sedi } },
      select: { id: true },
    });
    return { strutturaId: { in: strutture.map((s) => s.id) } };
  };
}

function vendingChildFilter(appId: AppId) {
  return async (req: Request) => {
    if (!hasAppAccess(req, appId)) return NO_RESULTS;
    const sedi = allowedSedi(req);
    if (!sedi) return undefined; // tutte le sedi
    if (sedi.length === 0) return NO_RESULTS; // nessuna sede abilitata
    const strutture = await prisma.vendingStruttura.findMany({
      where: { sedeCentraleId: { in: sedi } },
      select: { id: true },
    });
    return { strutturaId: { in: strutture.map((s) => s.id) } };
  };
}

/** Converte un periodoId (usato dal frontend) in un range di date ISO YYYY-MM-DD.
 *  Restituisce null se periodoId è "tutto" (nessun filtro data). */
function periodoToDateRange(periodoId: string): { da: Date; a: Date } | null {
  if (!periodoId || periodoId === "tutto") return null;
  const now = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth();
  const lunedi = new Date(now);
  lunedi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  lunedi.setHours(0, 0, 0, 0);
  switch (periodoId) {
    case "sett-corrente": {
      // lunedì → domenica della settimana corrente
      const da = new Date(lunedi); da.setHours(0, 0, 0, 0);
      const a = new Date(lunedi); a.setDate(lunedi.getDate() + 6); a.setHours(23, 59, 59, 999);
      return { da, a };
    }
    case "sett-prec": {
      // lunedì → domenica della settimana scorsa
      const da = new Date(lunedi); da.setDate(lunedi.getDate() - 7); da.setHours(0, 0, 0, 0);
      const a = new Date(lunedi); a.setDate(lunedi.getDate() - 1); a.setHours(23, 59, 59, 999);
      return { da, a };
    }
    case "mese-corrente": {
      // 1° giorno → ultimo giorno del mese corrente
      const da = new Date(anno, mese, 1, 0, 0, 0, 0);
      const a = new Date(anno, mese + 1, 0, 23, 59, 59, 999);
      return { da, a };
    }
    case "mese-prec": {
      // 1° giorno → ultimo giorno del mese precedente
      const da = new Date(anno, mese - 1, 1, 0, 0, 0, 0);
      const a = new Date(anno, mese, 0, 23, 59, 59, 999);
      return { da, a };
    }
    case "anno-corrente": {
      // 1 gennaio → 31 dicembre dell'anno corrente
      const da = new Date(anno, 0, 1, 0, 0, 0, 0);
      const a = new Date(anno, 11, 31, 23, 59, 59, 999);
      return { da, a };
    }
    case "anno-prec": {
      // 1 gennaio → 31 dicembre dell'anno scorso
      const da = new Date(anno - 1, 0, 1, 0, 0, 0, 0);
      const a = new Date(anno - 1, 11, 31, 23, 59, 59, 999);
      return { da, a };
    }
    default: return null;
  }
}

const app = express();

const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
app.use(cors(corsOrigins ? { origin: corsOrigins.split(",").map((s) => s.trim()) } : {}));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", requireAuth);
// test commento
// Manutenzioni
app.use("/api/strutture", makeCrudRouter(prisma.struttura as never, { idPrefix: "STR", modelName: "Struttura" }));
app.use("/api/zone", makeCrudRouter(prisma.zona as never, { idPrefix: "ZON", modelName: "Zona" }));
app.use("/api/camere", makeCrudRouter(prisma.camera as never, { idPrefix: "CAM", modelName: "Camera" }));
app.use("/api/oggetti", makeCrudRouter(prisma.oggetto as never, { idPrefix: "OBJ", modelName: "Oggetto" }));
app.use("/api/manutenzioni", makeCrudRouter(prisma.manutenzione as never, { idPrefix: "MNT", modelName: "Manutenzione", paginated: true }));
app.use("/api/tempi-registrati", makeCrudRouter(prisma.tempoRegistrato as never, { idPrefix: "TMP", modelName: "TempoRegistrato" }));
app.use("/api/materiali", makeCrudRouter(prisma.materiale as never, { idPrefix: "MAT", modelName: "Materiale" }));
app.use("/api/storico", makeCrudRouter(prisma.storicoModifica as never, { idPrefix: "LOG", modelName: "StoricoModifica" }));
app.use("/api/ditte", makeCrudRouter(prisma.ditta as never, { idPrefix: "DIT", modelName: "Ditta" }));
app.use("/api/manutentori", makeCrudRouter(prisma.manutentore as never, { idPrefix: "MAN", modelName: "Manutentore" }));
app.use("/api/figure-professionali", makeCrudRouter(prisma.figuraProfessionale as never, { idPrefix: "FIG", modelName: "FiguraProfessionale" }));

// Utenti e accessi
// La password non è mai gestita via API CRUD: viene ignorata dall'input e omessa dall'output.
// L'unico account con password è l'admin, impostato tramite lo script seed-admin.ts.
app.use("/api/utenti/accounts", makeCrudRouter(prisma.utentiAccount as never, { idPrefix: "ACC", modelName: "UtentiAccount", omit: ["password"], stripFields: ["password"] }));
app.use("/api/utenti/ruoli", makeCrudRouter(prisma.utentiRuolo as never, { idPrefix: "RUOLO", modelName: "UtentiRuolo" }));
app.use("/api/utenti/sostituti", makeCrudRouter(prisma.utentiSostituto as never, { idPrefix: "SOST", modelName: "UtentiSostituto" }));
app.use("/api/utenti/sedi", makeCrudRouter(prisma.utentiSede as never, { idPrefix: "SEDE", modelName: "UtentiSede" }));

// Ticket IT
app.use("/api/ticket/strutture", makeCrudRouter(prisma.ticketStruttura as never, { idPrefix: "TSTR", modelName: "TicketStruttura" }));
app.use("/api/ticket/utenti", makeCrudRouter(prisma.ticketUtente as never, { idPrefix: "UTE", modelName: "TicketUtente" }));
app.use("/api/ticket/tickets", makeCrudRouter(prisma.ticket as never, { idPrefix: "TIC", modelName: "Ticket", paginated: true }));

// Baggy Locker
app.use("/api/locker/strutture", makeCrudRouter(prisma.lockerStruttura as never, { idPrefix: "LOC", modelName: "LockerStruttura", filter: struttureFilter("baggyLocker") }));

// Dashboard Locker: restituisce tutti gli ordini del periodo richiesto per aggregazioni client-side
app.get("/api/locker/ordini/dashboard", async (req, res, next) => {
  try {
    const periodoId = (req.query.periodo as string) || "mese-corrente";
    const range = periodoToDateRange(periodoId);
    const sedi = allowedSedi(req);

    // Calcola il filtro strutturaId in base alle sedi abilitate
    let strutturaFilter: { strutturaId: { in: string[] } } | undefined;
    if (sedi !== null) {
      if (sedi.length === 0) { res.json([]); return; }
      const strutture = await prisma.lockerStruttura.findMany({ where: { sedeCentraleId: { in: sedi } }, select: { id: true } });
      strutturaFilter = { strutturaId: { in: strutture.map((s) => s.id) } };
    }

    const where = {
      ...(strutturaFilter ?? {}),
      ...(range ? { dataOrdine: { gte: range.da, lte: range.a } } : {}),
    };

    const ordini = await prisma.lockerOrdine.findMany({ where });
    // Serializza Decimal e DateTime
    const result = ordini.map((o) => ({
      ...o,
      dataOrdine: (o.dataOrdine as Date).toISOString().slice(0, 10),
      inizio: (o.inizio as Date).toISOString().slice(0, 10),
      fine: (o.fine as Date).toISOString().slice(0, 10),
      prezzo: Number(o.prezzo),
    }));
    res.json(result);
  } catch (err) { next(err); }
});

app.use("/api/locker/ordini", makeCrudRouter(prisma.lockerOrdine as never, { idPrefix: "ORD", modelName: "LockerOrdine", filter: lockerChildFilter("baggyLocker"), paginated: true }));
app.use("/api/locker/locali", makeCrudRouter(prisma.lockerLocale as never, { idPrefix: "LOA", modelName: "LockerLocale", filter: lockerChildFilter("baggyLocker") }));
app.use("/api/locker/vendite", makeCrudRouter(prisma.lockerVendita as never, { idPrefix: "LVEN", modelName: "LockerVendita", filter: lockerChildFilter("baggyLocker") }));

// Vending Machine
app.use("/api/vending/strutture", makeCrudRouter(prisma.vendingStruttura as never, {
  idPrefix: "VSTR",
  modelName: "VendingStruttura",
  filter: struttureFilter("vendingMachine"),
  preDelete: async (_req, id) => {
    await prisma.vendingVendita.deleteMany({ where: { strutturaId: id } });
    await prisma.vendingMacchina.deleteMany({ where: { strutturaId: id } });
  },
}));
app.use("/api/vending/macchine", makeCrudRouter(prisma.vendingMacchina as never, { idPrefix: "MAC", modelName: "VendingMacchina", filter: vendingChildFilter("vendingMachine") }));

// Dashboard Vending: restituisce tutti i record del periodo per grafico, articoli e card stats
app.get("/api/vending/vendite/dashboard", async (req, res, next) => {
  try {
    const periodoId = (req.query.periodo as string) || "mese-corrente";
    const range = periodoToDateRange(periodoId);
    const sedi = allowedSedi(req);

    let strutturaFilter: { strutturaId: { in: string[] } } | undefined;
    if (sedi !== null) {
      if (sedi.length === 0) { res.json([]); return; }
      const strutture = await prisma.vendingStruttura.findMany({ where: { sedeCentraleId: { in: sedi } }, select: { id: true } });
      strutturaFilter = { strutturaId: { in: strutture.map((s) => s.id) } };
    }

    const where = {
      ...(strutturaFilter ?? {}),
      ...(range ? { data: { gte: range.da, lte: range.a } } : {}),
    };

    const vendite = await prisma.vendingVendita.findMany({ where });
    const result = vendite.map((v) => ({
      ...v,
      data: (v.data as Date).toISOString().slice(0, 10),
      prezzoUnitario: Number(v.prezzoUnitario),
    }));
    res.json(result);
  } catch (err) { next(err); }
});

// Stats Vending: aggregati server-side (totaleIncasso, nVendite, totalePezzi, nCompletate)
// calcolati con query SQL aggregate — non trasferisce record al client.
// Query params: periodo, struttura (strutturaId), stato, metodoPagamento
app.get("/api/vending/vendite/stats", async (req, res, next) => {
  try {
    const periodoId = (req.query.periodo as string) || "tutto";
    const range = periodoToDateRange(periodoId);
    const sedi = allowedSedi(req);

    // Filtro sedi abilitate per l'utente
    let strutturaIds: string[] | null = null; // null = tutte
    if (sedi !== null) {
      if (sedi.length === 0) {
        res.json({ totaleIncasso: 0, nVendite: 0, totalePezzi: 0, nCompletate: 0 });
        return;
      }
      const strutture = await prisma.vendingStruttura.findMany({
        where: { sedeCentraleId: { in: sedi } },
        select: { id: true },
      });
      strutturaIds = strutture.map((s) => s.id);
    }

    // Filtro struttura esplicito dal frontend (es. dropdown "Tutte le sedi")
    const strutturaParam = req.query.struttura as string | undefined;

    const whereBase = {
      ...(strutturaIds !== null ? { strutturaId: { in: strutturaIds } } : {}),
      ...(strutturaParam ? { strutturaId: strutturaParam } : {}),
      ...(range ? { data: { gte: range.da, lte: range.a } } : {}),
      ...(req.query.stato ? { stato: req.query.stato as string } : {}),
      ...(req.query.metodoPagamento ? { metodoPagamento: req.query.metodoPagamento as string } : {}),
    };

    // Aggregati su TUTTE le vendite che soddisfano i filtri
    const [aggAll, aggCompletate] = await Promise.all([
      prisma.vendingVendita.aggregate({
        where: whereBase,
        _count: { id: true },
      }),
      prisma.vendingVendita.aggregate({
        where: { ...whereBase, stato: "Completata" },
        _count: { id: true },
        _sum: { quantita: true, prezzoUnitario: true },
      }),
    ]);

    // prezzoUnitario è Decimal — va moltiplicato per quantita per ogni riga.
    // Prisma non supporta aggregate su espressioni calcolate, quindi usiamo
    // queryRawUnsafe con parametri posizionali ($1, $2, …) per SQL Server.
    // Costruiamo la clausola WHERE dinamicamente con Prisma.sql.
    const conditions: Prisma.Sql[] = [Prisma.sql`stato = 'Completata'`];
    if (strutturaIds !== null && !strutturaParam) {
      if (strutturaIds.length === 0) {
        res.json({ totaleIncasso: 0, nVendite: Number(aggAll._count.id), totalePezzi: 0, nCompletate: 0 });
        return;
      }
      conditions.push(Prisma.sql`strutturaId IN (${Prisma.join(strutturaIds)})`);
    }
    if (strutturaParam) conditions.push(Prisma.sql`strutturaId = ${strutturaParam}`);
    if (range) {
      conditions.push(Prisma.sql`data >= ${range.da}`);
      conditions.push(Prisma.sql`data <= ${range.a}`);
    }
    if (req.query.metodoPagamento) {
      conditions.push(Prisma.sql`metodoPagamento = ${req.query.metodoPagamento as string}`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    const rawResult = await prisma.$queryRaw<{ totale: number | null; pezzi: number | null }[]>(
      Prisma.sql`SELECT
        SUM(CAST(prezzoUnitario AS FLOAT) * CAST(quantita AS FLOAT)) AS totale,
        SUM(CAST(quantita AS FLOAT)) AS pezzi
      FROM vending_vendite
      ${whereClause}`
    );

    res.json({
      nVendite: Number(aggAll._count.id),
      nCompletate: Number(aggCompletate._count.id),
      totalePezzi: Number(rawResult[0]?.pezzi ?? 0),
      totaleIncasso: Number(rawResult[0]?.totale ?? 0),
    });
  } catch (err) { next(err); }
});

app.use("/api/vending/vendite", makeCrudRouter(prisma.vendingVendita as never, { idPrefix: "VEN", modelName: "VendingVendita", filter: vendingChildFilter("vendingMachine"), paginated: true }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = parseInt(process.env.PORT ?? "4000", 10);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
