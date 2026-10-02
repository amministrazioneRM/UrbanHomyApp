import "dotenv/config";
import express from "express";
import cors from "cors";
import prisma from "./prisma.js";
import { makeCrudRouter } from "./routes/crud.js";
import { requireAuth } from "./auth.js";
import authRoutes from "./routes/auth.js";

const app = express();

const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
app.use(cors(corsOrigins ? { origin: corsOrigins.split(",").map((s) => s.trim()) } : {}));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", requireAuth);

// Manutenzioni
app.use("/api/strutture", makeCrudRouter(prisma.struttura as never, { idPrefix: "STR", modelName: "Struttura" }));
app.use("/api/zone", makeCrudRouter(prisma.zona as never, { idPrefix: "ZON", modelName: "Zona" }));
app.use("/api/camere", makeCrudRouter(prisma.camera as never, { idPrefix: "CAM", modelName: "Camera" }));
app.use("/api/oggetti", makeCrudRouter(prisma.oggetto as never, { idPrefix: "OBJ", modelName: "Oggetto" }));
app.use("/api/manutenzioni", makeCrudRouter(prisma.manutenzione as never, { idPrefix: "MNT", modelName: "Manutenzione" }));
app.use("/api/tempi-registrati", makeCrudRouter(prisma.tempoRegistrato as never, { idPrefix: "TMP", modelName: "TempoRegistrato" }));
app.use("/api/materiali", makeCrudRouter(prisma.materiale as never, { idPrefix: "MAT", modelName: "Materiale" }));
app.use("/api/storico", makeCrudRouter(prisma.storicoModifica as never, { idPrefix: "LOG", modelName: "StoricoModifica" }));
app.use("/api/ditte", makeCrudRouter(prisma.ditta as never, { idPrefix: "DIT", modelName: "Ditta" }));
app.use("/api/manutentori", makeCrudRouter(prisma.manutentore as never, { idPrefix: "MAN", modelName: "Manutentore" }));
app.use("/api/figure-professionali", makeCrudRouter(prisma.figuraProfessionale as never, { idPrefix: "FIG", modelName: "FiguraProfessionale" }));

// Utenti e accessi
app.use("/api/utenti/accounts", makeCrudRouter(prisma.utentiAccount as never, { idPrefix: "ACC", modelName: "UtentiAccount", omit: ["password"], hashFields: ["password"] }));
app.use("/api/utenti/ruoli", makeCrudRouter(prisma.utentiRuolo as never, { idPrefix: "RUOLO", modelName: "UtentiRuolo" }));
app.use("/api/utenti/sostituti", makeCrudRouter(prisma.utentiSostituto as never, { idPrefix: "SOST", modelName: "UtentiSostituto" }));
app.use("/api/utenti/sedi", makeCrudRouter(prisma.utentiSede as never, { idPrefix: "SEDE", modelName: "UtentiSede" }));

// Ticket IT
app.use("/api/ticket/strutture", makeCrudRouter(prisma.ticketStruttura as never, { idPrefix: "TSTR", modelName: "TicketStruttura" }));
app.use("/api/ticket/utenti", makeCrudRouter(prisma.ticketUtente as never, { idPrefix: "UTE", modelName: "TicketUtente" }));
app.use("/api/ticket/tickets", makeCrudRouter(prisma.ticket as never, { idPrefix: "TIC", modelName: "Ticket" }));

// Baggy Locker
app.use("/api/locker/strutture", makeCrudRouter(prisma.lockerStruttura as never, { idPrefix: "LOC", modelName: "LockerStruttura" }));
app.use("/api/locker/ordini", makeCrudRouter(prisma.lockerOrdine as never, { idPrefix: "ORD", modelName: "LockerOrdine" }));
app.use("/api/locker/locali", makeCrudRouter(prisma.lockerLocale as never, { idPrefix: "LOA", modelName: "LockerLocale" }));
app.use("/api/locker/vendite", makeCrudRouter(prisma.lockerVendita as never, { idPrefix: "LVEN", modelName: "LockerVendita" }));

// Vending Machine
app.use("/api/vending/strutture", makeCrudRouter(prisma.vendingStruttura as never, { idPrefix: "VSTR", modelName: "VendingStruttura" }));
app.use("/api/vending/macchine", makeCrudRouter(prisma.vendingMacchina as never, { idPrefix: "MAC", modelName: "VendingMacchina" }));
app.use("/api/vending/vendite", makeCrudRouter(prisma.vendingVendita as never, { idPrefix: "VEN", modelName: "VendingVendita" }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = parseInt(process.env.PORT ?? "4000", 10);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
