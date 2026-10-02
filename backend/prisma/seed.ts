/* Seed di sviluppo: stessi dati di esempio già presenti in src/App.jsx,
   utili per avere un ambiente locale popolato senza partire da zero. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const oggi = new Date();
const dPlus = (n: number): Date => {
  const d = new Date(oggi);
  d.setDate(d.getDate() + n);
  return d;
};

const seedFigureProfessionali = [
  { id: "FIG-1", nome: "Manutentore generico" },
  { id: "FIG-2", nome: "Tecnico climatizzazione" },
  { id: "FIG-3", nome: "Idraulico" },
  { id: "FIG-4", nome: "Elettricista" },
  { id: "FIG-5", nome: "Tecnico antincendio" },
  { id: "FIG-6", nome: "Apprendista" },
];

const seedStrutture = [
  { id: "STR-1", nome: "Hotello Trieste", citta: "Trieste", tipo: "Ostello" },
  { id: "STR-2", nome: "Hotello Padova", citta: "Padova", tipo: "Ostello" },
  { id: "STR-3", nome: "Urban Homy Gorizia", citta: "Gorizia", tipo: "B&B" },
  { id: "STR-4", nome: "Europalace Hotel", citta: "Monfalcone", tipo: "Albergo" },
];

const seedZone = [
  { id: "ZON-1", strutturaId: "STR-1", nome: "Piano 1", tipo: "piano" },
  { id: "ZON-2", strutturaId: "STR-1", nome: "Piano 2", tipo: "piano" },
  { id: "ZON-3", strutturaId: "STR-1", nome: "Reception & Lounge", tipo: "comune" },
  { id: "ZON-4", strutturaId: "STR-1", nome: "Cucina comune", tipo: "comune" },
  { id: "ZON-5", strutturaId: "STR-2", nome: "Piano 1", tipo: "piano" },
  { id: "ZON-6", strutturaId: "STR-2", nome: "Reception & Lounge", tipo: "comune" },
  { id: "ZON-7", strutturaId: "STR-3", nome: "Piano Terra", tipo: "piano" },
  { id: "ZON-8", strutturaId: "STR-3", nome: "Terrazza & area comune", tipo: "comune" },
  { id: "ZON-9", strutturaId: "STR-4", nome: "Piano 1", tipo: "piano" },
  { id: "ZON-10", strutturaId: "STR-4", nome: "Piano 2", tipo: "piano" },
  { id: "ZON-11", strutturaId: "STR-4", nome: "Reception", tipo: "comune" },
];

const seedCamere = [
  { id: "CAM-1", zonaId: "ZON-1", numero: "101", tipo: "Dormitorio 4 letti" },
  { id: "CAM-2", zonaId: "ZON-1", numero: "102", tipo: "Doppia" },
  { id: "CAM-3", zonaId: "ZON-2", numero: "201", tipo: "Dormitorio 6 letti" },
  { id: "CAM-4", zonaId: "ZON-5", numero: "P1", tipo: "Dormitorio 4 letti" },
  { id: "CAM-5", zonaId: "ZON-5", numero: "P2", tipo: "Doppia" },
  { id: "CAM-6", zonaId: "ZON-7", numero: "1", tipo: "Doppia" },
  { id: "CAM-7", zonaId: "ZON-7", numero: "2", tipo: "Tripla" },
  { id: "CAM-8", zonaId: "ZON-7", numero: "3", tipo: "Appartamento" },
  { id: "CAM-9", zonaId: "ZON-9", numero: "101", tipo: "Doppia" },
  { id: "CAM-10", zonaId: "ZON-9", numero: "102", tipo: "Singola" },
  { id: "CAM-11", zonaId: "ZON-10", numero: "201", tipo: "Suite" },
];

const seedOggetti = [
  { id: "OBJ-1", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", nome: "Letti a castello (x2)", categoria: "Arredo", codiceCespite: "TS-AR-001", condizione: "Buono" },
  { id: "OBJ-2", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", nome: "Climatizzatore", categoria: "Impianto", codiceCespite: "TS-IM-001", condizione: "Da verificare" },
  { id: "OBJ-3", strutturaId: "STR-1", zonaId: "ZON-3", camereId: null, nome: "Macchina caffè reception", categoria: "Attrezzatura", codiceCespite: "TS-AT-001", condizione: "Buono" },
  { id: "OBJ-4", strutturaId: "STR-1", zonaId: "ZON-4", camereId: null, nome: "Frigorifero cucina comune", categoria: "Elettrodomestico", codiceCespite: "TS-EL-001", condizione: "Da sostituire" },
  { id: "OBJ-5", strutturaId: "STR-2", zonaId: "ZON-5", camereId: "CAM-4", nome: "Armadietti con lucchetto", categoria: "Arredo", codiceCespite: "PD-AR-001", condizione: "Buono" },
  { id: "OBJ-6", strutturaId: "STR-2", zonaId: "ZON-6", camereId: null, nome: "TV area comune", categoria: "Elettrodomestico", codiceCespite: "PD-EL-001", condizione: "Guasto" },
  { id: "OBJ-7", strutturaId: "STR-3", zonaId: "ZON-7", camereId: "CAM-6", nome: "Climatizzatore", categoria: "Impianto", codiceCespite: "GO-IM-001", condizione: "Buono" },
  { id: "OBJ-8", strutturaId: "STR-3", zonaId: "ZON-8", camereId: null, nome: "Arredo terrazza (tavolo + sedie)", categoria: "Arredo", codiceCespite: "GO-AR-001", condizione: "Da verificare" },
  { id: "OBJ-9", strutturaId: "STR-4", zonaId: "ZON-9", camereId: "CAM-9", nome: "Minibar", categoria: "Elettrodomestico", codiceCespite: "MO-EL-001", condizione: "Buono" },
  { id: "OBJ-10", strutturaId: "STR-4", zonaId: "ZON-10", camereId: "CAM-11", nome: "Vasca idromassaggio", categoria: "Impianto", codiceCespite: "MO-IM-001", condizione: "Da verificare" },
  { id: "OBJ-11", strutturaId: "STR-4", zonaId: "ZON-11", camereId: null, nome: "Divano reception", categoria: "Arredo", codiceCespite: "MO-AR-001", condizione: "Buono" },
];

const seedDitte = [
  { id: "DIT-1", ragioneSociale: "ClimaTS Srl", piva: "IT00812345678", indirizzo: "Via dell'Industria 12, Gorizia (GO)", telefono: "+39 0481 555 111", email: "assistenza@climats.it", referente: "Sig. Andrea Colussi", specializzazioni: JSON.stringify(["Climatizzazione", "Impianti"]), strutture: JSON.stringify([]), attivo: true, dataFineContratto: new Date("2027-06-30"), approvatoreId: "MAN-1", note: "Contratto di manutenzione annuale su tutti gli impianti clima del gruppo.",
    tariffe: JSON.stringify([
      { id: "TAR-1", figuraProfessionaleId: "FIG-2", tariffaOraria: 45, scadenza: "2026-12-31" },
      { id: "TAR-2", figuraProfessionaleId: "FIG-6", tariffaOraria: 28, scadenza: "2026-12-31" },
    ]),
  },
  { id: "DIT-2", ragioneSociale: "Idro Service Snc", piva: "IT00898765432", indirizzo: "Via Marconi 45, Monfalcone (GO)", telefono: "+39 0481 555 222", email: "info@idroservice.it", referente: "Sig. Paolo Bianchi", specializzazioni: JSON.stringify(["Idraulico", "Piscine/vasche"]), strutture: JSON.stringify(["STR-4"]), attivo: true, dataFineContratto: new Date("2026-12-31"), approvatoreId: "MAN-2", note: "",
    tariffe: JSON.stringify([{ id: "TAR-3", figuraProfessionaleId: "FIG-3", tariffaOraria: 40, scadenza: "2026-06-30" }]),
  },
  { id: "DIT-3", ragioneSociale: "Sicurezza FVG Srl", piva: "IT00856781234", indirizzo: "Via Udine 8, Udine (UD)", telefono: "+39 0432 555 333", email: "info@sicurezzafvg.it", referente: "Sig.ra Giulia Moretti", specializzazioni: JSON.stringify(["Antincendio", "Sicurezza"]), strutture: JSON.stringify([]), attivo: true, dataFineContratto: new Date("2026-07-31"), approvatoreId: "MAN-1", note: "Ispezioni semestrali obbligatorie per legge. Contratto in scadenza, da rinnovare.", tariffe: JSON.stringify([]) },
  { id: "DIT-4", ragioneSociale: "Elettro Trieste Srl", piva: "IT00834567890", indirizzo: "Via San Nicolò 3, Trieste (TS)", telefono: "+39 040 555 444", email: "info@elettrotrieste.it", referente: "Sig. Stefano Kovac", specializzazioni: JSON.stringify(["Elettrico"]), strutture: JSON.stringify(["STR-1", "STR-2"]), attivo: true, dataFineContratto: new Date("2027-01-31"), approvatoreId: "MAN-1", note: "", tariffe: JSON.stringify([]) },
];

const seedManutentori = [
  { id: "MAN-1", nome: "Marco Bortolotti", tipo: "Interno", dittaId: null, visibilita: "tutti", figuraProfessionaleId: "FIG-1", telefono: "+39 340 123 4567", email: "marco.b@urbanhomy.it", strutture: JSON.stringify([]), attivo: true, note: "Copre tutte le strutture del gruppo.", sostitutoId: "MAN-2" },
  { id: "MAN-2", nome: "Luca Ferrin", tipo: "Interno", dittaId: null, visibilita: "tutti", figuraProfessionaleId: "FIG-3", telefono: "+39 349 876 5432", email: "luca.f@urbanhomy.it", strutture: JSON.stringify(["STR-1", "STR-3"]), attivo: true, note: "", sostitutoId: null },
  { id: "MAN-3", nome: "Andrea Colussi", tipo: "Esterno", dittaId: "DIT-1", visibilita: "assegnati", figuraProfessionaleId: "FIG-2", telefono: "+39 348 111 2222", email: "a.colussi@climats.it", strutture: JSON.stringify([]), attivo: true, note: "" },
  { id: "MAN-4", nome: "Paolo Bianchi", tipo: "Esterno", dittaId: "DIT-2", visibilita: "assegnati", figuraProfessionaleId: "FIG-3", telefono: "+39 347 222 3333", email: "p.bianchi@idroservice.it", strutture: JSON.stringify(["STR-4"]), attivo: true, note: "" },
  { id: "MAN-5", nome: "Giulia Moretti", tipo: "Esterno", dittaId: "DIT-3", visibilita: "tutti", figuraProfessionaleId: "FIG-5", telefono: "+39 346 333 4444", email: "g.moretti@sicurezzafvg.it", strutture: JSON.stringify([]), attivo: true, note: "" },
  { id: "MAN-6", nome: "Stefano Kovac", tipo: "Esterno", dittaId: "DIT-4", visibilita: "assegnati", figuraProfessionaleId: "FIG-4", telefono: "+39 345 444 5555", email: "s.kovac@elettrotrieste.it", strutture: JSON.stringify(["STR-1", "STR-2"]), attivo: true, note: "" },
];

const seedManutenzioni = [
  { id: "MNT-1", tipo: "singola", strutturaId: "STR-1", zonaId: "ZON-4", camereId: null, oggettoId: "OBJ-4", titolo: "Frigorifero cucina comune non raffredda", descrizione: "Ospiti segnalano che il frigo non tiene la temperatura.", priorita: "Alta", stato: "Da fare", dataCreazione: dPlus(-1), scadenza: dPlus(1), assegnatoId: "MAN-1", note: "", foto: JSON.stringify([]) },
  { id: "MNT-2", tipo: "singola", strutturaId: "STR-2", zonaId: "ZON-6", camereId: null, oggettoId: "OBJ-6", titolo: "TV lounge guasta", descrizione: "Schermo nero, non si accende nemmeno da presa diretta.", priorita: "Media", stato: "In corso", dataCreazione: dPlus(-3), scadenza: dPlus(0), assegnatoId: "MAN-6", note: "Ricambio ordinato.", foto: JSON.stringify([]) },
  { id: "MNT-3", tipo: "programmata", strutturaId: "STR-4", zonaId: "ZON-10", camereId: "CAM-11", oggettoId: "OBJ-10", titolo: "Controllo periodico vasca idromassaggio", descrizione: "Verifica pompe, guarnizioni e sanificazione impianto.", priorita: "Media", stato: "Da fare", dataCreazione: dPlus(-10), scadenza: dPlus(4), assegnatoId: "MAN-4", ricorrenza: JSON.stringify({ intervallo: 3, unita: "mesi" }), note: "", foto: JSON.stringify([]) },
  { id: "MNT-4", tipo: "programmata", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", oggettoId: "OBJ-2", titolo: "Controllo climatizzatori dormitorio", descrizione: "Pulizia filtri e controllo gas refrigerante.", priorita: "Bassa", stato: "Da fare", dataCreazione: dPlus(-5), scadenza: dPlus(20), assegnatoId: "MAN-3", ricorrenza: JSON.stringify({ intervallo: 6, unita: "mesi" }), note: "", foto: JSON.stringify([]) },
  { id: "MNT-5", tipo: "programmata", strutturaId: "STR-3", zonaId: "ZON-7", camereId: null, oggettoId: null, titolo: "Ispezione antincendio", descrizione: "Verifica rilevatori fumo ed estintori su tutto il piano.", priorita: "Urgente", stato: "Da fare", dataCreazione: dPlus(-2), scadenza: dPlus(-1), assegnatoId: "MAN-5", ricorrenza: JSON.stringify({ intervallo: 6, unita: "mesi" }), note: "", foto: JSON.stringify([]) },
  { id: "MNT-6", tipo: "programmata", strutturaId: "STR-4", zonaId: "ZON-10", camereId: "CAM-11", oggettoId: "OBJ-10", titolo: "Sostituzione guarnizioni pompa vasca idromassaggio", descrizione: "Guarnizioni usurate, perdita d'acqua rilevata durante controllo periodico.", priorita: "Media", stato: "Completata", dataCreazione: dPlus(-9), scadenza: dPlus(-5), dataApprovazione: dPlus(-4), assegnatoId: "MAN-4", ricorrenza: JSON.stringify({ intervallo: 3, unita: "mesi" }), note: "", notaChiusura: "Guarnizioni sostituite, impianto testato e funzionante.", foto: JSON.stringify([]) },
  { id: "MNT-7", tipo: "singola", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", oggettoId: null, titolo: "Sostituzione lampadina corridoio", descrizione: "Lampadina bruciata segnalata da ospite.", priorita: "Bassa", stato: "Completata", dataCreazione: dPlus(-3), scadenza: dPlus(-2), dataApprovazione: dPlus(-2), assegnatoId: "MAN-1", note: "", notaChiusura: "Lampadina sostituita.", foto: JSON.stringify([]) },
];

const seedTempiRegistrati = [
  { id: "TMP-1", manutenzioneId: "MNT-2", manutentoreId: "MAN-6", minuti: 45, data: dPlus(-3), note: "Diagnosi guasto" },
  { id: "TMP-2", manutenzioneId: "MNT-2", manutentoreId: "MAN-6", minuti: 30, data: dPlus(-1), note: "Attesa ricambio" },
  { id: "TMP-3", manutenzioneId: "MNT-6", manutentoreId: "MAN-4", minuti: 90, data: dPlus(-6), note: "Sostituzione guarnizioni pompa" },
  { id: "TMP-4", manutenzioneId: "MNT-7", manutentoreId: "MAN-1", minuti: 10, data: dPlus(-2), note: "Sostituzione lampadina" },
];

const seedMateriali = [
  { id: "MAT-1", manutenzioneId: "MNT-2", nome: "Compressore frigo 1/4 HP", quantita: 1, costoUnitario: 180, note: "Ricambio originale", stato: "Ordinato" },
  { id: "MAT-2", manutenzioneId: "MNT-6", nome: "Kit guarnizioni pompa", quantita: 2, costoUnitario: 35, note: "", stato: "Fatturato" },
];

const seedStorico = [
  { id: "LOG-seed-1", manutenzioneId: "MNT-6", data: dPlus(-4), utenteId: "MAN-1", dettagli: JSON.stringify(["Stato: In accettazione → Completata"]) },
  { id: "LOG-seed-2", manutenzioneId: "MNT-7", data: dPlus(-2), utenteId: "MAN-1", dettagli: JSON.stringify(["Stato: In corso → Completata"]) },
];

async function main(): Promise<void> {
  // ripulisce in ordine di dipendenza per rendere lo script ripetibile
  await prisma.storicoModifica.deleteMany();
  await prisma.materiale.deleteMany();
  await prisma.tempoRegistrato.deleteMany();
  await prisma.manutenzione.deleteMany();
  await prisma.oggetto.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.zona.deleteMany();
  await prisma.manutentore.deleteMany();
  await prisma.ditta.deleteMany();
  await prisma.struttura.deleteMany();
  await prisma.figuraProfessionale.deleteMany();

  await prisma.figuraProfessionale.createMany({ data: seedFigureProfessionali });
  await prisma.struttura.createMany({ data: seedStrutture });
  await prisma.zona.createMany({ data: seedZone });
  await prisma.camera.createMany({ data: seedCamere });
  await prisma.oggetto.createMany({ data: seedOggetti });

  await prisma.ditta.createMany({ data: seedDitte });

  await prisma.manutentore.createMany({ data: seedManutentori });
  await prisma.manutenzione.createMany({ data: seedManutenzioni });
  await prisma.tempoRegistrato.createMany({ data: seedTempiRegistrati });
  await prisma.materiale.createMany({ data: seedMateriali });
  await prisma.storicoModifica.createMany({ data: seedStorico });

  console.log("Seed completato.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
