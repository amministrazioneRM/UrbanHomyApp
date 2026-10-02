/* Seed una tantum per le 4 app sorelle (Utenti, Ticket IT, Baggy Locker,
   Vending Machine), portando nel DB condiviso gli stessi dati di esempio
   che vivevano nei rispettivi useState/localStorage. */
import path from "path";
import { PrismaClient } from "@prisma/client";
import { extractSeed } from "./extract-seed.js";

const prisma = new PrismaClient();

const APPS_DIR = path.resolve(__dirname, "..", "..", "apps");
const APP_NAME_MAP: Record<string, string> = {
  "urban-homy-locker": "locker",
  "urban-homy-vending": "vending",
};
const p = (app: string, rel: string): string => path.join(APPS_DIR, APP_NAME_MAP[app] || app, rel);

async function seedUtenti(): Promise<void> {
  // Dati piccoli e statici, riportati direttamente da urban-homy-shared/accounts.js
  const APPS = ["manutenzioni", "ticketIt", "baggyLocker", "vendingMachine"];
  const MODULI: Record<string, string[]> = {
    manutenzioni: ["interventi", "calendario", "censimento", "manutentori", "ditte", "anagrafica"],
    ticketIt: ["ticket", "utenti"],
    baggyLocker: ["ordini", "vending", "sedi"],
    vendingMachine: ["vendite", "sedi"],
  };
  const permessiVuoti = () => ({ lettura: false, modifica: false, creazione: false, eliminazione: false });
  const permessiCompleti = () => ({ lettura: true, modifica: true, creazione: true, eliminazione: true });
  const matrice = (appId: string, tipo: string): Record<string, ReturnType<typeof permessiVuoti>> => {
    const m: Record<string, ReturnType<typeof permessiVuoti>> = {};
    MODULI[appId].forEach((modId) => { m[modId] = tipo === "completi" ? permessiCompleti() : permessiVuoti(); });
    return m;
  };
  const ruoloAdminId = (appId: string) => `RUOLO-${appId}-admin`;
  const ruoloUtenteId = (appId: string) => `RUOLO-${appId}-utente`;

  const ruoli = APPS.flatMap((appId) => {
    const matriceUtente = matrice(appId, "vuoti");
    Object.keys(matriceUtente).forEach((modId) => { matriceUtente[modId].lettura = true; });
    return [
      { id: ruoloAdminId(appId), appId, nome: "Amministratore", bloccato: true, permessi: JSON.stringify(matrice(appId, "completi")) },
      { id: ruoloUtenteId(appId), appId, nome: "Utente", bloccato: false, permessi: JSON.stringify(matriceUtente) },
    ];
  });

  const accounts = [
    { id: "ACC-1", nome: "Amministratore", email: "admin@urbanhomy.it", password: "admin123", ruoloGlobale: "Amministratore", accessi: JSON.stringify(Object.fromEntries(APPS.map((a) => [a, { abilitato: false, ruoloId: ruoloUtenteId(a) }]))) },
    { id: "ACC-2", nome: "Marco Bortolotti", email: "marco.b@urbanhomy.it", password: "manutenzione123", ruoloGlobale: "Utente", accessi: JSON.stringify({ manutenzioni: { abilitato: true, ruoloId: ruoloAdminId("manutenzioni") }, ticketIt: { abilitato: false, ruoloId: ruoloUtenteId("ticketIt") } }) },
    { id: "ACC-3", nome: "Maria Conti", email: "maria.c@urbanhomy.it", password: "reception123", ruoloGlobale: "Utente", accessi: JSON.stringify({ manutenzioni: { abilitato: false, ruoloId: ruoloUtenteId("manutenzioni") }, ticketIt: { abilitato: true, ruoloId: ruoloUtenteId("ticketIt") } }) },
    { id: "ACC-4", nome: "Davide Russo", email: "davide.r@urbanhomy.it", password: "amministrazione123", ruoloGlobale: "Utente", accessi: JSON.stringify({ manutenzioni: { abilitato: false, ruoloId: ruoloUtenteId("manutenzioni") }, ticketIt: { abilitato: true, ruoloId: ruoloAdminId("ticketIt") } }) },
  ];

  const sedi = [
    { id: "SEDE-1", nome: "Hotello Trieste", tipo: "Hotel", citta: "Trieste", indirizzo: "", attiva: true },
    { id: "SEDE-2", nome: "Hotello Padova", tipo: "Hotel", citta: "Padova", indirizzo: "", attiva: true },
    { id: "SEDE-3", nome: "Urban Homy Gorizia", tipo: "B&B", citta: "Gorizia", indirizzo: "", attiva: true },
    { id: "SEDE-4", nome: "Europalace Hotel", tipo: "Hotel", citta: "Monfalcone", indirizzo: "", attiva: true },
    { id: "SEDE-5", nome: "Sede amministrativa", tipo: "Sede amministrativa", citta: "", indirizzo: "", attiva: true },
    { id: "SEDE-6", nome: "Baggy Locker Padova", tipo: "Deposito bagagli", citta: "Padova", indirizzo: "", attiva: true },
    { id: "SEDE-7", nome: "Baggy Locker Trieste", tipo: "Deposito bagagli", citta: "Trieste", indirizzo: "", attiva: false },
  ];

  await prisma.utentiSostituto.deleteMany();
  await prisma.utentiAccount.deleteMany();
  await prisma.utentiRuolo.deleteMany();
  await prisma.utentiSede.deleteMany();

  await prisma.utentiRuolo.createMany({ data: ruoli });
  await prisma.utentiAccount.createMany({ data: accounts });
  await prisma.utentiSede.createMany({ data: sedi });
  console.log(`Utenti: ${ruoli.length} ruoli, ${accounts.length} account, ${sedi.length} sedi`);
}

async function seedTicketIt(): Promise<void> {
  const seedStrutture = [
    { id: "STR-1", nome: "Hotello Trieste" },
    { id: "STR-2", nome: "Hotello Padova" },
    { id: "STR-3", nome: "Urban Homy Gorizia" },
    { id: "STR-4", nome: "Europalace Hotel" },
    { id: "STR-5", nome: "Sede amministrativa" },
  ];
  const seedUtenti = [
    { id: "UTE-1", nome: "Maria Conti", email: "maria.c@urbanhomy.it", strutturaId: "STR-1", reparto: "Reception" },
    { id: "UTE-2", nome: "Davide Russo", email: "davide.r@urbanhomy.it", strutturaId: "STR-5", reparto: "Amministrazione" },
    { id: "UTE-3", nome: "Elena Fabris", email: "elena.f@urbanhomy.it", strutturaId: "STR-2", reparto: "Direzione" },
    { id: "UTE-4", nome: "Nicola Zanetti", email: "nicola.z@urbanhomy.it", strutturaId: "STR-3", reparto: "Reception" },
    { id: "UTE-5", nome: "Sara Bevilacqua", email: "sara.b@urbanhomy.it", strutturaId: "STR-4", reparto: "Housekeeping" },
    { id: "UTE-6", nome: "Luca Bortolussi", email: "luca.b@urbanhomy.it", strutturaId: "STR-1", reparto: "Ristorazione/Bar" },
  ];
  const oggi = new Date();
  const dPlus = (n: number): Date => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d; };
  const seedTicket = [
    { id: "TIC-1", strutturaId: "STR-1", reparto: "Reception", titolo: "Stampante reception non stampa", descrizione: "La stampante degli scontrini si blocca dopo la prima pagina.", categoria: "Hardware", priorita: "Alta", stato: "Aperto", dataCreazione: dPlus(-1), scadenza: dPlus(1), richiedente: "Maria Conti", note: "", foto: JSON.stringify([]) },
    { id: "TIC-2", strutturaId: "STR-2", reparto: "Reception", titolo: "Gestionale prenotazioni non si connette", descrizione: "Il PMS perde la connessione internet più volte al giorno.", categoria: "Rete", priorita: "Urgente", stato: "In corso", dataCreazione: dPlus(-2), scadenza: dPlus(0), richiedente: "Elena Fabris", note: "Verifica router in corso con il fornitore.", foto: JSON.stringify([]) },
    { id: "TIC-3", strutturaId: "STR-5", reparto: "Amministrazione", titolo: "Nuovo account email per assunzione", descrizione: "Serve una casella email per il nuovo collega in amministrazione.", categoria: "Account", priorita: "Media", stato: "Aperto", dataCreazione: dPlus(-1), scadenza: dPlus(3), richiedente: "Davide Russo", note: "", foto: JSON.stringify([]) },
    { id: "TIC-4", strutturaId: "STR-3", reparto: "Reception", titolo: "PC reception si riavvia da solo", descrizione: "Il computer si riavvia improvvisamente durante il check-in.", categoria: "Hardware", priorita: "Alta", stato: "Aperto", dataCreazione: dPlus(-4), scadenza: dPlus(-1), richiedente: "Nicola Zanetti", note: "", foto: JSON.stringify([]) },
    { id: "TIC-5", strutturaId: "STR-4", reparto: "Reception", titolo: "Aggiornamento software gestionale cassa", descrizione: "Va installato l'ultimo aggiornamento del software di cassa.", categoria: "Software", priorita: "Bassa", stato: "Risolto", dataCreazione: dPlus(-8), scadenza: dPlus(-5), richiedente: "Sara Bevilacqua", note: "Aggiornato in remoto.", foto: JSON.stringify([]) },
    { id: "TIC-6", strutturaId: "STR-1", reparto: "Ristorazione/Bar", titolo: "Wifi ospiti lento", descrizione: "Gli ospiti segnalano una connessione wifi molto lenta in sala colazione.", categoria: "Rete", priorita: "Media", stato: "In corso", dataCreazione: dPlus(-3), scadenza: dPlus(5), richiedente: "Luca Bortolussi", note: "", foto: JSON.stringify([]) },
  ];

  await prisma.ticket.deleteMany();
  await prisma.ticketUtente.deleteMany();
  await prisma.ticketStruttura.deleteMany();

  await prisma.ticketStruttura.createMany({ data: seedStrutture });
  await prisma.ticketUtente.createMany({ data: seedUtenti });
  await prisma.ticket.createMany({ data: seedTicket });
  console.log(`Ticket IT: ${seedStrutture.length} strutture, ${seedUtenti.length} utenti, ${seedTicket.length} ticket`);
}

// Prisma createMany vuole Date reali (o ISO-8601 completo), non "YYYY-MM-DD" nudo.
function withDates(rows: unknown[], fields: string[]): unknown[] {
  return (rows as Record<string, unknown>[]).map((r) => {
    const out = { ...r };
    for (const f of fields) if (out[f]) out[f] = new Date(out[f] as string);
    return out;
  });
}

async function seedLocker(): Promise<void> {
  const file = p("urban-homy-locker", "src/App.jsx");
  const seedStrutture = extractSeed(file, "seedStrutture");
  const seedOrdini = withDates(extractSeed(file, "seedOrdini"), ["dataOrdine", "inizio", "fine"]);
  const seedVendite = withDates(extractSeed(file, "seedVendite"), ["data"]);

  await prisma.lockerVendita.deleteMany();
  await prisma.lockerLocale.deleteMany();
  await prisma.lockerOrdine.deleteMany();
  await prisma.lockerStruttura.deleteMany();

  await prisma.lockerStruttura.createMany({ data: seedStrutture as never[] });
  await prisma.lockerOrdine.createMany({ data: seedOrdini as never[] });
  await prisma.lockerVendita.createMany({ data: seedVendite as never[] });
  console.log(`Locker: ${seedStrutture.length} strutture, ${seedOrdini.length} ordini, ${seedVendite.length} vendite`);
}

async function seedVending(): Promise<void> {
  const file = p("urban-homy-vending", "src/App.jsx");
  const seedStrutture = extractSeed(file, "seedStrutture");
  const seedMacchine = extractSeed(file, "seedMacchine");
  const seedVendite = withDates(extractSeed(file, "seedVendite"), ["data"]);

  await prisma.vendingVendita.deleteMany();
  await prisma.vendingMacchina.deleteMany();
  await prisma.vendingStruttura.deleteMany();

  await prisma.vendingStruttura.createMany({ data: seedStrutture as never[] });
  await prisma.vendingMacchina.createMany({ data: seedMacchine as never[] });
  await prisma.vendingVendita.createMany({ data: seedVendite as never[] });
  console.log(`Vending: ${seedStrutture.length} strutture, ${seedMacchine.length} macchine, ${seedVendite.length} vendite`);
}

async function main(): Promise<void> {
  await seedUtenti();
  await seedTicketIt();
  await seedLocker();
  await seedVending();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
