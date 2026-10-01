import React, { useState, useMemo, useEffect } from "react";
import {
  Building2, MapPin, Wrench, CalendarClock, Plus, ChevronDown, ChevronRight,
  ChevronLeft, X, AlertTriangle, CheckCircle2, Clock3, Trash2, Pencil, LayoutGrid,
  Search, DoorClosed, Sofa, Repeat, Ban, ClipboardList, ClipboardCheck,
  ShieldCheck, ShieldAlert, HelpCircle, XCircle, Camera, ImagePlus,
  Users, UserCog, Phone, Mail, Star, Settings, Briefcase, Filter, ArrowLeft, UserCheck, RotateCcw, BadgeCheck,
  BarChart3, FileText, Receipt
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import UHAccounts from "./accounts";
import type { UHAccount } from "./accounts";
import { api, useSyncedResource, useBackendOffline } from "./api";

/* ------------------------------------------------------------------ */
/*  DOMAIN INTERFACES                                                   */
/* ------------------------------------------------------------------ */

interface Struttura { id: string; nome: string; citta: string; tipo: string; eliminato: boolean }
interface Zona { id: string; strutturaId: string; nome: string; tipo: string; eliminato?: boolean }
interface Camera { id: string; zonaId: string; numero: string; tipo: string; eliminato?: boolean }
interface Oggetto { id: string; strutturaId: string; zonaId?: string; camereId?: string | null; nome: string; categoria: string; codiceCespite: string; condizione: string; ultimaVerifica?: string | null; eliminato?: boolean }
interface RicorrenzaJson { intervallo: number; unita: string }
interface Manutenzione { id: string; tipo: string; strutturaId: string; zonaId?: string; camereId?: string | null; oggettoId?: string | null; titolo: string; descrizione: string; priorita: string; stato: string; dataCreazione: string; scadenza: string; dataApprovazione?: string | null; assegnatoId?: string | null; assegnatoLibero?: string | null; ricorrenza?: RicorrenzaJson | null; note?: string; notaChiusura?: string; foto: string[] }
interface TempoRegistrato { id: string; manutenzioneId: string; manutentoreId: string; minuti: number; data: string; note?: string }
interface Materiale { id: string; manutenzioneId: string; nome: string; quantita: number; costoUnitario: number; note?: string; stato: string }
interface StoricoModifica { id: string; manutenzioneId: string; data: string; utenteId: string | null; dettagli: string[] }
interface TariffaJson { id: string; figuraProfessionaleId: string; tariffaOraria: number; scadenza: string | null }
interface Ditta { id: string; ragioneSociale: string; piva: string; indirizzo?: string; telefono?: string; email?: string; referente?: string; specializzazioni: string[]; strutture: string[]; attivo: boolean; dataFineContratto?: string; approvatoreId?: string; note?: string; tariffe: TariffaJson[]; eliminato?: boolean }
interface Manutentore { id: string; nome: string; tipo: string; dittaId?: string | null; visibilita: string; figuraProfessionaleId?: string; telefono?: string; email?: string; strutture: string[]; attivo: boolean; note?: string; sostitutoId?: string | null; eliminato?: boolean }
interface FiguraProfessionale { id: string; nome: string; eliminato?: boolean }

type Modale =
  | { type: "nuovaManutenzione"; payload: null; prefill?: Partial<Manutenzione> & { strutturaId?: string; zonaId?: string; camereId?: string; oggettoId?: string; titolo?: string; priorita?: string } }
  | { type: "modificaManutenzione"; payload: Manutenzione; prefill?: never }
  | { type: "nuovoManutentore"; payload: null; prefillManutentore?: Partial<Manutentore> }
  | { type: "modificaManutentore"; payload: Manutentore }
  | { type: "nuovaDitta"; payload: null }
  | { type: "modificaDitta"; payload: Ditta }
const APP_ID = "manutenzioni";

/* ------------------------------------------------------------------ */
/*  DATI DI PARTENZA — Gruppo Urban Homy                               */
/*  (Hotello Trieste, Hotello Padova, Urban Homy Gorizia B&B,          */
/*   Urban Homy Monfalcone albergo)                                    */
/* ------------------------------------------------------------------ */

let _id = 1000;
const nid = (p: string): string => `${p}-${_id++}`;

const seedStrutture: Struttura[] = [
  { id: "STR-1", nome: "Hotello Trieste", citta: "Trieste", tipo: "Ostello", eliminato: false },
  { id: "STR-2", nome: "Hotello Padova", citta: "Padova", tipo: "Ostello", eliminato: false },
  { id: "STR-3", nome: "Urban Homy Gorizia", citta: "Gorizia", tipo: "B&B", eliminato: false },
  { id: "STR-4", nome: "Europalace Hotel", citta: "Monfalcone", tipo: "Albergo", eliminato: false },
];

const seedZone = [
  // Hotello Trieste
  { id: "ZON-1", strutturaId: "STR-1", nome: "Piano 1", tipo: "piano" },
  { id: "ZON-2", strutturaId: "STR-1", nome: "Piano 2", tipo: "piano" },
  { id: "ZON-3", strutturaId: "STR-1", nome: "Reception & Lounge", tipo: "comune" },
  { id: "ZON-4", strutturaId: "STR-1", nome: "Cucina comune", tipo: "comune" },
  // Hotello Padova
  { id: "ZON-5", strutturaId: "STR-2", nome: "Piano 1", tipo: "piano" },
  { id: "ZON-6", strutturaId: "STR-2", nome: "Reception & Lounge", tipo: "comune" },
  // Urban Homy Gorizia (B&B, via Paolo Diacono)
  { id: "ZON-7", strutturaId: "STR-3", nome: "Piano Terra", tipo: "piano" },
  { id: "ZON-8", strutturaId: "STR-3", nome: "Terrazza & area comune", tipo: "comune" },
  // Urban Homy Monfalcone (albergo)
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

// Il censimento è volutamente parziale: la piattaforma è pensata per
// completare l'inventario struttura per struttura, zona per zona.
const seedOggetti = [
  { id: "OBJ-1", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", nome: "Letti a castello (x2)", categoria: "Arredo", codiceCespite: "TS-AR-001", condizione: "Buono", ultimaVerifica: null },
  { id: "OBJ-2", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", nome: "Climatizzatore", categoria: "Impianto", codiceCespite: "TS-IM-001", condizione: "Da verificare", ultimaVerifica: null },
  { id: "OBJ-3", strutturaId: "STR-1", zonaId: "ZON-3", camereId: null, nome: "Macchina caffè reception", categoria: "Attrezzatura", codiceCespite: "TS-AT-001", condizione: "Buono", ultimaVerifica: null },
  { id: "OBJ-4", strutturaId: "STR-1", zonaId: "ZON-4", camereId: null, nome: "Frigorifero cucina comune", categoria: "Elettrodomestico", codiceCespite: "TS-EL-001", condizione: "Da sostituire", ultimaVerifica: null },
  { id: "OBJ-5", strutturaId: "STR-2", zonaId: "ZON-5", camereId: "CAM-4", nome: "Armadietti con lucchetto", categoria: "Arredo", codiceCespite: "PD-AR-001", condizione: "Buono", ultimaVerifica: null },
  { id: "OBJ-6", strutturaId: "STR-2", zonaId: "ZON-6", camereId: null, nome: "TV area comune", categoria: "Elettrodomestico", codiceCespite: "PD-EL-001", condizione: "Guasto", ultimaVerifica: null },
  { id: "OBJ-7", strutturaId: "STR-3", zonaId: "ZON-7", camereId: "CAM-6", nome: "Climatizzatore", categoria: "Impianto", codiceCespite: "GO-IM-001", condizione: "Buono", ultimaVerifica: null },
  { id: "OBJ-8", strutturaId: "STR-3", zonaId: "ZON-8", camereId: null, nome: "Arredo terrazza (tavolo + sedie)", categoria: "Arredo", codiceCespite: "GO-AR-001", condizione: "Da verificare", ultimaVerifica: null },
  { id: "OBJ-9", strutturaId: "STR-4", zonaId: "ZON-9", camereId: "CAM-9", nome: "Minibar", categoria: "Elettrodomestico", codiceCespite: "MO-EL-001", condizione: "Buono", ultimaVerifica: null },
  { id: "OBJ-10", strutturaId: "STR-4", zonaId: "ZON-10", camereId: "CAM-11", nome: "Vasca idromassaggio", categoria: "Impianto", codiceCespite: "MO-IM-001", condizione: "Da verificare", ultimaVerifica: null },
  { id: "OBJ-11", strutturaId: "STR-4", zonaId: "ZON-11", camereId: null, nome: "Divano reception", categoria: "Arredo", codiceCespite: "MO-AR-001", condizione: "Buono", ultimaVerifica: null },
];

const oggi = new Date();
const dPlus = (n: number): string => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const seedManutenzioni = [
  {
    id: "MNT-1", tipo: "singola", strutturaId: "STR-1", zonaId: "ZON-4", camereId: null, oggettoId: "OBJ-4",
    titolo: "Frigorifero cucina comune non raffredda", descrizione: "Ospiti segnalano che il frigo non tiene la temperatura.",
    priorita: "Alta", stato: "Da fare", dataCreazione: dPlus(-1), scadenza: dPlus(1),
    assegnatoId: "MAN-1", assegnatoLibero: null, ricorrenza: null, note: "", foto: [],
  },
  {
    id: "MNT-2", tipo: "singola", strutturaId: "STR-2", zonaId: "ZON-6", camereId: null, oggettoId: "OBJ-6",
    titolo: "TV lounge guasta", descrizione: "Schermo nero, non si accende nemmeno da presa diretta.",
    priorita: "Media", stato: "In corso", dataCreazione: dPlus(-3), scadenza: dPlus(0),
    assegnatoId: "MAN-6", assegnatoLibero: null, ricorrenza: null, note: "Ricambio ordinato.", foto: [],
  },
  {
    id: "MNT-3", tipo: "programmata", strutturaId: "STR-4", zonaId: "ZON-10", camereId: "CAM-11", oggettoId: "OBJ-10",
    titolo: "Controllo periodico vasca idromassaggio", descrizione: "Verifica pompe, guarnizioni e sanificazione impianto.",
    priorita: "Media", stato: "Da fare", dataCreazione: dPlus(-10), scadenza: dPlus(4),
    assegnatoId: "MAN-4", assegnatoLibero: null, ricorrenza: { intervallo: 3, unita: "mesi" }, note: "", foto: [],
  },
  {
    id: "MNT-4", tipo: "programmata", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", oggettoId: "OBJ-2",
    titolo: "Controllo climatizzatori dormitorio", descrizione: "Pulizia filtri e controllo gas refrigerante.",
    priorita: "Bassa", stato: "Da fare", dataCreazione: dPlus(-5), scadenza: dPlus(20),
    assegnatoId: "MAN-3", assegnatoLibero: null, ricorrenza: { intervallo: 6, unita: "mesi" }, note: "", foto: [],
  },
  {
    id: "MNT-5", tipo: "programmata", strutturaId: "STR-3", zonaId: "ZON-7", camereId: null, oggettoId: null,
    titolo: "Ispezione antincendio", descrizione: "Verifica rilevatori fumo ed estintori su tutto il piano.",
    priorita: "Urgente", stato: "Da fare", dataCreazione: dPlus(-2), scadenza: dPlus(-1),
    assegnatoId: "MAN-5", assegnatoLibero: null, ricorrenza: { intervallo: 6, unita: "mesi" }, note: "", foto: [],
  },
  {
    id: "MNT-6", tipo: "programmata", strutturaId: "STR-4", zonaId: "ZON-10", camereId: "CAM-11", oggettoId: "OBJ-10",
    titolo: "Sostituzione guarnizioni pompa vasca idromassaggio", descrizione: "Guarnizioni usurate, perdita d'acqua rilevata durante controllo periodico.",
    priorita: "Media", stato: "Completata", dataCreazione: dPlus(-9), scadenza: dPlus(-5), dataApprovazione: dPlus(-4),
    assegnatoId: "MAN-4", assegnatoLibero: null, ricorrenza: { intervallo: 3, unita: "mesi" }, note: "", notaChiusura: "Guarnizioni sostituite, impianto testato e funzionante.", foto: [],
  },
  {
    id: "MNT-7", tipo: "singola", strutturaId: "STR-1", zonaId: "ZON-1", camereId: "CAM-1", oggettoId: null,
    titolo: "Sostituzione lampadina corridoio", descrizione: "Lampadina bruciata segnalata da ospite.",
    priorita: "Bassa", stato: "Completata", dataCreazione: dPlus(-3), scadenza: dPlus(-2), dataApprovazione: dPlus(-2),
    assegnatoId: "MAN-1", assegnatoLibero: null, ricorrenza: null, note: "", notaChiusura: "Lampadina sostituita.", foto: [],
  },
];

// tempoRegistrato, materiali e storico non vivono più annidati dentro ogni
// manutenzione: sono collezioni proprie, ciascuna riga referenzia la sua
// manutenzione tramite manutenzioneId — lo stesso shape che avranno le
// tabelle figlie nel futuro schema SQL Server.
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
  { id: "LOG-seed-1", manutenzioneId: "MNT-6", data: new Date(dPlus(-4)).toISOString(), utenteId: "MAN-1", dettagli: ["Stato: In accettazione → Completata"] },
  { id: "LOG-seed-2", manutenzioneId: "MNT-7", data: new Date(dPlus(-2)).toISOString(), utenteId: "MAN-1", dettagli: ["Stato: In corso → Completata"] },
];

const seedDitte = [
  { id: "DIT-1", ragioneSociale: "ClimaTS Srl", piva: "IT00812345678", indirizzo: "Via dell'Industria 12, Gorizia (GO)", telefono: "+39 0481 555 111", email: "assistenza@climats.it", referente: "Sig. Andrea Colussi", specializzazioni: ["Climatizzazione", "Impianti"], strutture: [], attivo: true, dataFineContratto: "2027-06-30", approvatoreId: "MAN-1", note: "Contratto di manutenzione annuale su tutti gli impianti clima del gruppo.",
    tariffe: [
      { id: "TAR-1", figuraProfessionaleId: "FIG-2", tariffaOraria: 45, scadenza: "2026-12-31" },
      { id: "TAR-2", figuraProfessionaleId: "FIG-6", tariffaOraria: 28, scadenza: "2026-12-31" },
    ],
  },
  { id: "DIT-2", ragioneSociale: "Idro Service Snc", piva: "IT00898765432", indirizzo: "Via Marconi 45, Monfalcone (GO)", telefono: "+39 0481 555 222", email: "info@idroservice.it", referente: "Sig. Paolo Bianchi", specializzazioni: ["Idraulico", "Piscine/vasche"], strutture: ["STR-4"], attivo: true, dataFineContratto: "2026-12-31", approvatoreId: "MAN-2", note: "",
    tariffe: [
      { id: "TAR-3", figuraProfessionaleId: "FIG-3", tariffaOraria: 40, scadenza: "2026-06-30" },
    ],
  },
  { id: "DIT-3", ragioneSociale: "Sicurezza FVG Srl", piva: "IT00856781234", indirizzo: "Via Udine 8, Udine (UD)", telefono: "+39 0432 555 333", email: "info@sicurezzafvg.it", referente: "Sig.ra Giulia Moretti", specializzazioni: ["Antincendio", "Sicurezza"], strutture: [], attivo: true, dataFineContratto: "2026-07-31", approvatoreId: "MAN-1", note: "Ispezioni semestrali obbligatorie per legge. Contratto in scadenza, da rinnovare.", tariffe: [] },
  { id: "DIT-4", ragioneSociale: "Elettro Trieste Srl", piva: "IT00834567890", indirizzo: "Via San Nicolò 3, Trieste (TS)", telefono: "+39 040 555 444", email: "info@elettrotrieste.it", referente: "Sig. Stefano Kovac", specializzazioni: ["Elettrico"], strutture: ["STR-1", "STR-2"], attivo: true, dataFineContratto: "2027-01-31", approvatoreId: "MAN-1", note: "", tariffe: [] },
];

const seedManutentori = [
  { id: "MAN-1", nome: "Marco Bortolotti", tipo: "Interno", dittaId: null, visibilita: "tutti", figuraProfessionaleId: "FIG-1", telefono: "+39 340 123 4567", email: "marco.b@urbanhomy.it", strutture: [], attivo: true, note: "Copre tutte le strutture del gruppo.", sostitutoId: "MAN-2" },
  { id: "MAN-2", nome: "Luca Ferrin", tipo: "Interno", dittaId: null, visibilita: "tutti", figuraProfessionaleId: "FIG-3", telefono: "+39 349 876 5432", email: "luca.f@urbanhomy.it", strutture: ["STR-1", "STR-3"], attivo: true, note: "", sostitutoId: null },
  { id: "MAN-3", nome: "Andrea Colussi", tipo: "Esterno", dittaId: "DIT-1", visibilita: "assegnati", figuraProfessionaleId: "FIG-2", telefono: "+39 348 111 2222", email: "a.colussi@climats.it", strutture: [], attivo: true, note: "" },
  { id: "MAN-4", nome: "Paolo Bianchi", tipo: "Esterno", dittaId: "DIT-2", visibilita: "assegnati", figuraProfessionaleId: "FIG-3", telefono: "+39 347 222 3333", email: "p.bianchi@idroservice.it", strutture: ["STR-4"], attivo: true, note: "" },
  { id: "MAN-5", nome: "Giulia Moretti", tipo: "Esterno", dittaId: "DIT-3", visibilita: "tutti", figuraProfessionaleId: "FIG-5", telefono: "+39 346 333 4444", email: "g.moretti@sicurezzafvg.it", strutture: [], attivo: true, note: "" },
  { id: "MAN-6", nome: "Stefano Kovac", tipo: "Esterno", dittaId: "DIT-4", visibilita: "assegnati", figuraProfessionaleId: "FIG-4", telefono: "+39 345 444 5555", email: "s.kovac@elettrotrieste.it", strutture: ["STR-1", "STR-2"], attivo: true, note: "" },
];

/* ------------------------------------------------------------------ */
/*  COSTANTI DI STILE                                                   */
/* ------------------------------------------------------------------ */

const PRIORITA = ["Bassa", "Media", "Alta", "Urgente"];
const STATI = ["Da fare", "Presa in carico", "In corso", "In accettazione", "Completata", "Annullata"];
const CATEGORIE = ["Arredo", "Attrezzatura", "Impianto", "Elettrodomestico", "Idraulico", "Altro"];
const UNITA_RICORRENZA = ["giorni", "settimane", "mesi", "anni"];
const CONDIZIONI = ["Buono", "Da verificare", "Da sostituire", "Guasto", "Mancante"];
const seedFigureProfessionali = [
  { id: "FIG-1", nome: "Manutentore generico" },
  { id: "FIG-2", nome: "Tecnico climatizzazione" },
  { id: "FIG-3", nome: "Idraulico" },
  { id: "FIG-4", nome: "Elettricista" },
  { id: "FIG-5", nome: "Tecnico antincendio" },
  { id: "FIG-6", nome: "Apprendista" },
];

const STATI_MATERIALE = ["Da ordinare", "Ordinato", "Fatturato"];
const statoMaterialeColor = {
  "Da ordinare": "bg-stone-100 text-stone-600 border-stone-300",
  "Ordinato": "bg-amber-50 text-amber-800 border-amber-400",
  "Fatturato": "bg-emerald-50 text-emerald-700 border-emerald-300",
};

const priColor = {
  Bassa: "bg-slate-100 text-slate-600 border-slate-300",
  Media: "bg-teal-50 text-teal-700 border-teal-300",
  Alta: "bg-amber-50 text-amber-800 border-amber-400",
  Urgente: "bg-rose-50 text-rose-700 border-rose-400",
};
const priDot = { Bassa: "bg-slate-400", Media: "bg-teal-500", Alta: "bg-amber-500", Urgente: "bg-rose-600" };

const statoColor = {
  "Da fare": "bg-slate-800 text-white",
  "Presa in carico": "bg-indigo-600 text-white",
  "In corso": "bg-teal-600 text-white",
  "In accettazione": "bg-amber-500 text-white",
  "Completata": "bg-emerald-600 text-white",
  "Annullata": "bg-stone-300 text-stone-600",
};
const statoIcon: Record<string, LucideIcon> = {
  "Da fare": Clock3, "Presa in carico": UserCheck, "In corso": Wrench, "In accettazione": ShieldAlert, "Completata": CheckCircle2, "Annullata": Ban,
};

const condColor = {
  "Buono": "bg-emerald-50 text-emerald-700 border-emerald-300",
  "Da verificare": "bg-amber-50 text-amber-800 border-amber-400",
  "Da sostituire": "bg-orange-50 text-orange-800 border-orange-400",
  "Guasto": "bg-rose-50 text-rose-700 border-rose-400",
  "Mancante": "bg-stone-100 text-stone-500 border-stone-300",
};
const condIcon: Record<string, LucideIcon> = {
  "Buono": ShieldCheck, "Da verificare": HelpCircle, "Da sostituire": ShieldAlert, "Guasto": XCircle, "Mancante": Ban,
};

function fmtData(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
function isScaduta(m: Manutenzione): boolean {
  return m.stato !== "Completata" && m.stato !== "Annullata" && m.scadenza < oggi.toISOString().slice(0, 10);
}
function fmtDurata(min: number | undefined): string {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}
function tempoTotale(manutenzioneId: string, tempiRegistrati: TempoRegistrato[]): number {
  return tempiRegistrati.filter((t) => t.manutenzioneId === manutenzioneId).reduce((s, t) => s + (t.minuti || 0), 0);
}
function fmtDataOra(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
function contrattoScaduto(ditta: Ditta | null | undefined): boolean {
  return !!(ditta && ditta.dataFineContratto && ditta.dataFineContratto < oggi.toISOString().slice(0, 10));
}
function tariffaScaduta(tariffa: TariffaJson | null | undefined): boolean {
  return !!(tariffa && tariffa.scadenza && tariffa.scadenza < oggi.toISOString().slice(0, 10));
}
// Un manutentore esterno è utilizzabile per nuovi interventi solo se collegato
// a una ditta attiva e con contratto non scaduto. Il personale interno è
// sempre disponibile (se attivo).
function manutentoreDisponibile(m: Manutentore, ditte: Ditta[]): boolean {
  if (m.eliminato) return false;
  if (!m.attivo) return false;
  if (m.tipo === "Interno") return true;
  const ditta = ditte.find((d) => d.id === m.dittaId);
  if (!ditta || ditta.eliminato || !ditta.attivo) return false;
  if (contrattoScaduto(ditta)) return false;
  return true;
}

const CAMPI_TRACCIATI = [
  ["titolo", "Titolo"],
  ["descrizione", "Descrizione"],
  ["priorita", "Priorità"],
  ["stato", "Stato"],
  ["scadenza", "Scadenza"],
  ["note", "Note"],
  ["notaChiusura", "Nota di chiusura"],
];

function nomeManutentoreId(id: string | null | undefined, manutentori: Manutentore[]): string | null {
  return (id && manutentori.find((m) => m.id === id)?.nome) || null;
}

interface ConTempoRegistrato extends Manutenzione {
  tempoRegistrato?: TempoRegistrato[];
}

function creaDettagliModifica(prima: ConTempoRegistrato, dopo: ConTempoRegistrato, manutentori: Manutentore[]): string[] {
  const dettagli = [];
  CAMPI_TRACCIATI.forEach(([campo, label]) => {
    const v1 = prima[campo] || "";
    const v2 = dopo[campo] || "";
    if (v1 !== v2) dettagli.push(`${label}: ${v1 || "—"} → ${v2 || "—"}`);
  });
  if (prima.strutturaId !== dopo.strutturaId || prima.zonaId !== dopo.zonaId || prima.camereId !== dopo.camereId || prima.oggettoId !== dopo.oggettoId) {
    dettagli.push("Posizione (struttura/zona/camera/oggetto) modificata");
  }

  if (prima.assegnatoId !== dopo.assegnatoId || prima.assegnatoLibero !== dopo.assegnatoLibero) {
    const etichetta = (m) => nomeManutentoreId(m.assegnatoId, manutentori) || m.assegnatoLibero || "—";
    dettagli.push(`Assegnato a: ${etichetta(prima)} → ${etichetta(dopo)}`);
  }

  const tempoPrima = prima.tempoRegistrato || [];
  const tempoDopo = dopo.tempoRegistrato || [];
  const idPrima = new Set(tempoPrima.map((t) => t.id));
  const idDopo = new Set(tempoDopo.map((t) => t.id));
  tempoDopo.forEach((t) => {
    if (!idPrima.has(t.id)) {
      dettagli.push(`Aggiunto tempo: ${fmtDurata(t.minuti)} (${nomeManutentoreId(t.manutentoreId, manutentori) || "—"})`);
    } else {
      const t0 = tempoPrima.find((x) => x.id === t.id);
      if (t0 && (t0.minuti !== t.minuti || t0.note !== t.note)) {
        dettagli.push(`Modificato tempo di ${nomeManutentoreId(t.manutentoreId, manutentori) || "—"}: ${fmtDurata(t0.minuti)} → ${fmtDurata(t.minuti)}`);
      }
    }
  });
  tempoPrima.forEach((t) => {
    if (!idDopo.has(t.id)) dettagli.push(`Rimosso tempo: ${fmtDurata(t.minuti)} (${nomeManutentoreId(t.manutentoreId, manutentori) || "—"})`);
  });

  if ((prima.foto || []).length !== (dopo.foto || []).length) {
    dettagli.push(`Foto: ${(prima.foto || []).length} → ${(dopo.foto || []).length}`);
  }
  return dettagli;
}

/* ------------------------------------------------------------------ */
/*  COMPONENTI DI SUPPORTO                                              */
/* ------------------------------------------------------------------ */

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, accent, onClick }: { label: string; value: React.ReactNode; icon: LucideIcon; accent: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 shadow-sm text-left ${
        onClick ? "cursor-pointer hover:border-[#C1622D]/50 hover:shadow-md transition" : ""
      }`}
    >
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-stone-900 leading-none font-[Fraunces]">{value}</div>
        <div className="text-xs text-stone-500 mt-1 tracking-wide uppercase">{label}</div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/50 backdrop-blur-sm p-3 overflow-y-auto">
      <div className={`bg-[#FBF9F4] rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} my-6 border border-stone-200 flex flex-col max-h-[calc(100vh-3rem)]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 shrink-0">
          <h3 className="font-[Fraunces] text-lg font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

// Come Field, ma con un <div> invece di <label>: usarlo quando il contenuto
// include più di un controllo interattivo (es. una lista con pulsanti), perché
// un <label> attiverebbe automaticamente il primo pulsante/input al suo interno
// a ogni click, anche su testo semplice.
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#C1622D]/40 focus:border-[#C1622D]";

/* ------------------------------------------------------------------ */
/*  APP                                                                  */
/* ------------------------------------------------------------------ */

export default function App() {
  const [strutture, setStrutture] = useSyncedResource(api.strutture, seedStrutture);
  const [zone, setZone] = useSyncedResource(api.zone, seedZone);
  const [camere, setCamere] = useSyncedResource(api.camere, seedCamere);
  const [oggetti, setOggetti] = useSyncedResource(api.oggetti, seedOggetti);
  const [manutenzioni, setManutenzioni] = useSyncedResource(api.manutenzioni, seedManutenzioni);
  const [tempiRegistrati, setTempiRegistrati] = useSyncedResource(api.tempiRegistrati, seedTempiRegistrati);
  const [materiali, setMateriali] = useSyncedResource(api.materiali, seedMateriali);
  const [storicoModifiche, setStoricoModifiche] = useSyncedResource(api.storico, seedStorico);
  const [manutentori, setManutentori] = useSyncedResource(api.manutentori, seedManutentori);
  const [ditte, setDitte] = useSyncedResource(api.ditte, seedDitte);
  const [figureProfessionali, setFigureProfessionali] = useSyncedResource(api.figureProfessionali, seedFigureProfessionali);
  const backendOffline = useBackendOffline();

  const [tab, setTab] = useState<string>("dashboard");
  const [utenteCorrenteId, setUtenteCorrenteId] = useState<string>(() => localStorage.getItem("uh_utenteCorrenteId") || "");
  const TAB_IMPOSTAZIONI = ["censimento", "team", "ditte", "figure", "strutture"];
  const [impostazioniAperte, setImpostazioniAperte] = useState<boolean>(TAB_IMPOSTAZIONI.includes(tab));
  const [modale, setModale] = useState<Modale | null>(null);
  const [filtroRapido, setFiltroRapido] = useState<{ tipo: string; token: number } | null>(null);

  const [sessione] = useState<UHAccount | null>(() => UHAccounts.loadSession());
  const puoAccedere = UHAccounts.hasAccesso(sessione, APP_ID);
  const isAdminApp = UHAccounts.ruoloIn(sessione, APP_ID) === "Amministratore";

  useEffect(() => {
    if (!isAdminApp && TAB_IMPOSTAZIONI.includes(tab)) setTab("dashboard");
  }, [isAdminApp, tab]);

  useEffect(() => {
    if (tab === "report" && !isAdminApp) setTab("dashboard");
  }, [tab, isAdminApp]);

  function apriFiltroRapido(tipo) {
    setTab("manutenzioni");
    setFiltroRapido({ tipo, token: Date.now() });
  }

  /* -------- helper lookup -------- */
  const struttureAttive = useMemo(() => strutture.filter((s) => !s.eliminato), [strutture]);
  const strutturaOf = (id) => strutture.find((s) => s.id === id);
  const zonaOf = (id) => zone.find((z) => z.id === id);
  const cameraOf = (id) => camere.find((c) => c.id === id);
  const zoneDi = (strId) => zone.filter((z) => z.strutturaId === strId && !z.eliminato);
  const camereDi = (zonaId) => camere.filter((c) => c.zonaId === zonaId && !c.eliminato);
  const oggettiDi = (zonaId, camereId) => oggetti.filter((o) => o.zonaId === zonaId && (camereId ? o.camereId === camereId : true) && !o.eliminato);

  const luogoLabel = (m) => {
    const str = strutturaOf(m.strutturaId)?.nome ?? "—";
    const zn = zonaOf(m.zonaId)?.nome ?? "—";
    const cm = m.camereId ? cameraOf(m.camereId)?.numero : null;
    return `${str} · ${zn}${cm ? ` · Camera ${cm}` : ""}`;
  };

  /* -------- CRUD manutenzioni -------- */
  // Un "assegnatoLibero" (nome digitato a mano, non presente tra i manutentori)
  // non deve mai finire salvato come testo libero: al salvataggio viene
  // trasformato in un vero manutentore (riusando quello esistente se il nome
  // corrisponde, altrimenti creandone uno nuovo di tipo "Esterno"), così ogni
  // intervento referenzia sempre un manutentoreId reale.
  function risolviAssegnatoLibero(dati) {
    if (dati.assegnatoId) return dati;
    const nome = (dati.assegnatoLibero || "").trim();
    if (!nome) return { ...dati, assegnatoLibero: null };
    const esistente = manutentori.find((m) => !m.eliminato && m.nome.toLowerCase() === nome.toLowerCase());
    const assegnatoId = esistente ? esistente.id : nid("MAN");
    if (!esistente) {
      setManutentori((ms) => [
        {
          id: assegnatoId, nome, tipo: "Esterno", dittaId: null, visibilita: "tutti", figuraProfessionaleId: "",
          telefono: "", email: "", strutture: [], attivo: true,
          note: "Creato automaticamente da un intervento (nome inserito manualmente).", sostitutoId: null, eliminato: false,
        },
        ...ms,
      ]);
    }
    return { ...dati, assegnatoId, assegnatoLibero: null };
  }

  // tempoRegistrato/materiali/storico arrivano dal form come liste già
  // complete per questo intervento: si sincronizzano le collezioni flat
  // sostituendo tutte le righe esistenti per manutenzioneId con quelle nuove.
  function salvaManutenzione(dati, nuoviTempi, nuoviMateriali, nuovoStorico) {
    const payload = risolviAssegnatoLibero(dati);
    let manutenzioneId = payload.id;
    if (manutenzioneId) {
      setManutenzioni((ms) => ms.map((m) => (m.id === manutenzioneId ? payload : m)));
    } else {
      manutenzioneId = nid("MNT");
      setManutenzioni((ms) => [{ ...payload, id: manutenzioneId, dataCreazione: oggi.toISOString().slice(0, 10) }, ...ms]);
    }
    setTempiRegistrati((ts) => [
      ...ts.filter((t) => t.manutenzioneId !== manutenzioneId),
      ...nuoviTempi.map((t) => ({ ...t, manutenzioneId })),
    ]);
    setMateriali((ms) => [
      ...ms.filter((mt) => mt.manutenzioneId !== manutenzioneId),
      ...nuoviMateriali.map((mt) => ({ ...mt, manutenzioneId })),
    ]);
    setStoricoModifiche((vs) => [
      ...nuovoStorico.map((v) => ({ ...v, manutenzioneId })),
      ...vs.filter((v) => v.manutenzioneId !== manutenzioneId),
    ]);
    setModale(null);
  }
  function eliminaManutenzione(id) {
    setManutenzioni((ms) => ms.filter((m) => m.id !== id));
    setTempiRegistrati((ts) => ts.filter((t) => t.manutenzioneId !== id));
    setMateriali((ms) => ms.filter((mt) => mt.manutenzioneId !== id));
    setStoricoModifiche((vs) => vs.filter((v) => v.manutenzioneId !== id));
    setModale(null);
  }
  function cambiaStato(id, stato) {
    const target = manutenzioni.find((m) => m.id === id);
    if (!target || target.stato === stato) return;
    setManutenzioni((ms) => ms.map((m) => {
      if (m.id !== id) return m;
      const dataApprovazione = stato === "Completata" ? oggi.toISOString().slice(0, 10) : null;
      return { ...m, stato, dataApprovazione };
    }));
    const utenteId = utenteCorrente ? utenteCorrente.id : null;
    const voceStorico = { id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, manutenzioneId: id, data: new Date().toISOString(), utenteId, dettagli: [`Stato: ${target.stato} → ${stato}`] };
    setStoricoModifiche((vs) => [voceStorico, ...vs]);
  }
  function creaInterventoDaOggetto(oggetto, titoloSuggerito) {
    setModale({
      type: "nuovaManutenzione",
      payload: null,
      prefill: {
        strutturaId: oggetto.strutturaId, zonaId: oggetto.zonaId, camereId: oggetto.camereId || "",
        oggettoId: oggetto.id, titolo: titoloSuggerito,
        priorita: oggetto.condizione === "Guasto" ? "Urgente" : "Alta",
      },
    });
  }

  /* -------- CRUD anagrafica -------- */
  function aggiungiStruttura(nome, citta, tipo) {
    setStrutture((s) => [...s, { id: nid("STR"), nome, citta, tipo, eliminato: false }]);
  }
  function eliminaStruttura(id) {
    setStrutture((s) => s.map((x) => (x.id === id ? { ...x, eliminato: true } : x)));
  }
  function aggiungiZona(strutturaId, nome, tipo) {
    setZone((z) => [...z, { id: nid("ZON"), strutturaId, nome, tipo }]);
  }
  function aggiungiCamera(zonaId, numero, tipoCamera) {
    setCamere((c) => [...c, { id: nid("CAM"), zonaId, numero, tipo: tipoCamera }]);
  }
  function aggiungiOggetto(strutturaId, zonaId, camereId, nome, categoria, codiceCespite = "", condizione = "Da verificare") {
    setOggetti((o) => [...o, { id: nid("OBJ"), strutturaId, zonaId, camereId: camereId || null, nome, categoria, codiceCespite: codiceCespite.trim(), condizione, ultimaVerifica: null }]);
  }
  function eliminaZona(id) { setZone((z) => z.map((x) => (x.id === id ? { ...x, eliminato: true } : x))); }
  function eliminaCamera(id) { setCamere((c) => c.map((x) => (x.id === id ? { ...x, eliminato: true } : x))); }
  function eliminaOggetto(id) { setOggetti((o) => o.map((x) => (x.id === id ? { ...x, eliminato: true } : x))); }
  function aggiornaOggetto(id, patch) {
    setOggetti((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function segnaVerificato(id, condizione) {
    aggiornaOggetto(id, { condizione, ultimaVerifica: oggi.toISOString().slice(0, 10) });
  }

  /* -------- CRUD manutentori -------- */
  function salvaManutentore(dati) {
    if (dati.id) {
      setManutentori((ms) => ms.map((m) => (m.id === dati.id ? dati : m)));
    } else {
      setManutentori((ms) => [{ ...dati, id: nid("MAN") }, ...ms]);
    }
    setModale(null);
  }
  function eliminaManutentore(id) {
    setManutentori((ms) => ms.map((m) => (m.id === id ? { ...m, eliminato: true } : m)));
    setModale(null);
  }

  /* -------- CRUD ditte esterne -------- */
  function salvaDitta(dati) {
    if (dati.id) {
      setDitte((ds) => ds.map((d) => (d.id === dati.id ? dati : d)));
    } else {
      setDitte((ds) => [{ ...dati, id: nid("DIT") }, ...ds]);
    }
    setModale(null);
  }
  // Soft-delete: NON si scollegano i tecnici (dittaId resta intatto). Se si
  // azzerasse dittaId, gli interventi già completati e fatturati da questa
  // ditta nei mesi passati perderebbero il collegamento e sparirebbero dal
  // gruppo "da fatturare" del Report, finendo scambiati per lavoro interno.
  // I tecnici restano semplicemente "non disponibili" per nuovi interventi
  // (manutentoreDisponibile controlla già ditta.eliminato).
  function eliminaDitta(id) {
    setDitte((ds) => ds.map((d) => (d.id === id ? { ...d, eliminato: true } : d)));
    setModale(null);
  }
  function nuovoTecnicoPerDitta(dittaId) {
    setModale({ type: "nuovoManutentore", payload: null, prefillManutentore: { tipo: "Esterno", dittaId } });
  }

  /* -------- CRUD figure professionali -------- */
  function aggiungiFiguraProfessionale(nome) {
    const n = nome.trim();
    if (!n || figureProfessionali.some((f) => !f.eliminato && f.nome.toLowerCase() === n.toLowerCase())) return;
    setFigureProfessionali((fs) => [...fs, { id: nid("FIG"), nome: n }]);
  }
  function eliminaFiguraProfessionale(id) {
    setFigureProfessionali((fs) => fs.map((f) => (f.id === id ? { ...f, eliminato: true } : f)));
  }

  /* -------- visibilità in base all'utente "connesso" -------- */
  const utenteCorrente = manutentori.find((m) => m.id === utenteCorrenteId) || null;
  const accessoLimitatoUtente = !!(utenteCorrente && utenteCorrente.tipo === "Esterno" && utenteCorrente.visibilita === "assegnati");

  const puoApprovare = useMemo(() => {
    if (!utenteCorrente) return true; // Amministratore (vede tutto)
    const approvatoriIds = new Set(ditte.map((d) => d.approvatoreId).filter(Boolean));
    if (approvatoriIds.has(utenteCorrente.id)) return true;
    const titolari = manutentori.filter((m) => m.sostitutoId === utenteCorrente.id);
    return titolari.some((t) => approvatoriIds.has(t.id));
  }, [utenteCorrente, ditte, manutentori]);

  useEffect(() => {
    if (tab === "approvazioni" && !puoApprovare) setTab("dashboard");
  }, [tab, puoApprovare]);
  const manutenzioniVisibili = useMemo(
    () => manutenzioni.filter((m) => !accessoLimitatoUtente || m.assegnatoId === utenteCorrente.id),
    [manutenzioni, accessoLimitatoUtente, utenteCorrente]
  );

  /* -------- stats -------- */
  const stats = useMemo(() => {
    const aperte = manutenzioniVisibili.filter((m) => m.stato === "Da fare" || m.stato === "Presa in carico" || m.stato === "In corso").length;
    const urgenti = manutenzioniVisibili.filter((m) => (m.priorita === "Urgente" || m.priorita === "Alta") && m.stato !== "Completata" && m.stato !== "Annullata").length;
    const scadute = manutenzioniVisibili.filter(isScaduta).length;
    const programmate = manutenzioniVisibili.filter((m) => m.tipo === "programmata" && m.stato !== "Completata" && m.stato !== "Annullata").length;
    const inApprovazione = manutenzioniVisibili.filter((m) => m.stato === "In accettazione").length;
    return { aperte, urgenti, scadute, programmate, inApprovazione };
  }, [manutenzioniVisibili]);

  const censimento = useMemo(() => {
    const oggettiAttivi = oggetti.filter((o) => !o.eliminato);
    const totale = oggettiAttivi.length;
    const daVerificare = oggettiAttivi.filter((o) => o.condizione === "Da verificare").length;
    const criticita = oggettiAttivi.filter((o) => o.condizione === "Guasto" || o.condizione === "Da sostituire").length;
    const verificati = oggettiAttivi.filter((o) => o.ultimaVerifica).length;
    return { totale, daVerificare, criticita, verificati, percVerificato: totale ? Math.round((verificati / totale) * 100) : 0 };
  }, [oggetti]);

  if (!puoAccedere) {
    return (
      <div className="min-h-screen w-full bg-[#F3F0E8] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-[#1B2430] flex items-center justify-center mx-auto mb-4">
            <Wrench size={26} className="text-white" />
          </div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
          <p className="text-stone-500 text-sm mb-6">
            {sessione
              ? "Il tuo account non ha accesso all'applicazione Manutenzioni. Contatta un amministratore del portale."
              : "Devi accedere dalla home page del portale per usare questa applicazione."}
          </p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#1B2430] hover:bg-[#111722] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
            <ArrowLeft size={15} /> Torna alla home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F3F0E8] text-stone-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        .font-\\[Fraunces\\] { font-family: 'Fraunces', serif; }
        .font-mono-tag { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {backendOffline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-rose-600 text-white text-xs font-semibold px-4 py-2 text-center">
          <AlertTriangle size={13} className="shrink-0" />
          Server non raggiungibile: le modifiche non vengono salvate. Verifica la connessione e ricarica la pagina.
        </div>
      )}

      <div className="flex flex-col md:flex-row min-h-screen">
        {/* SIDEBAR */}
        <aside className="md:w-60 shrink-0 bg-[#1B2430] text-stone-200 flex md:flex-col">
          <div className="px-5 py-5 border-b border-white/10 hidden md:block">
            <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3">
              <ChevronLeft size={12} /> Applicazioni Urban Homy
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#C1622D] flex items-center justify-center">
                <Wrench size={16} className="text-white" />
              </div>
              <div>
                <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Manutenzioni</div>
                <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · manutenzioni</div>
              </div>
            </div>
          </div>
          <nav className="flex md:flex-col w-full px-2 py-3 gap-1 overflow-x-auto md:overflow-visible">
            <a
              href="/"
              className="md:hidden flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-stone-400 hover:text-stone-200 hover:bg-white/5 transition"
              title="Applicazioni Urban Homy"
            >
              <ArrowLeft size={16} />
            </a>
            {[
              { id: "dashboard", label: "Cruscotto", icon: LayoutGrid },
              { id: "manutenzioni", label: "Interventi", icon: ClipboardList },
              ...(puoApprovare ? [{ id: "approvazioni", label: "Approvazioni", icon: ShieldCheck }] : []),
              ...(isAdminApp ? [{ id: "report", label: "Report", icon: BarChart3 }] : []),
              { id: "calendario", label: "Calendario", icon: CalendarClock },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}

            {isAdminApp && (
            <div className="md:mt-1">
              <button
                onClick={() => setImpostazioniAperte((v) => !v)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  TAB_IMPOSTAZIONI.includes(tab) ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                }`}
              >
                <Settings size={16} />
                Impostazioni
                <ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte ? "rotate-180" : ""}`} />
              </button>
              {impostazioniAperte && (
                <div className="flex md:flex-col gap-1 md:mt-1 md:pl-4 md:border-l md:border-white/10 md:ml-4">
                  {[
                    { id: "censimento", label: "Censimento", icon: ClipboardCheck },
                    { id: "team", label: "Manutentori", icon: Users },
                    { id: "ditte", label: "Ditte esterne", icon: Briefcase },
                    { id: "figure", label: "Figure professionali", icon: BadgeCheck },
                    { id: "strutture", label: "Anagrafica", icon: Building2 },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                      }`}
                    >
                      <t.icon size={15} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
          </nav>
          <div className="mt-auto px-3 py-3 border-t border-white/10">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 px-2 mb-1.5">Accesso come</div>
            <select
              value={utenteCorrenteId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setUtenteCorrenteId(e.target.value);
                localStorage.setItem("uh_utenteCorrenteId", e.target.value);
              }}
              className="w-full bg-white/10 text-stone-100 text-xs rounded-lg px-2.5 py-2 outline-none border border-white/10 focus:border-[#C1622D]"
            >
              <option value="" className="text-stone-800">Amministratore (vede tutto)</option>
              <optgroup label="Interni" className="text-stone-800">
                {manutentori.filter((m) => m.tipo === "Interno" && !m.eliminato).map((m) => <option key={m.id} value={m.id} className="text-stone-800">{m.nome}</option>)}
              </optgroup>
              <optgroup label="Esterni" className="text-stone-800">
                {manutentori.filter((m) => m.tipo === "Esterno" && !m.eliminato).map((m) => <option key={m.id} value={m.id} className="text-stone-800">{m.nome}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="px-5 py-3 text-[11px] text-stone-500 hidden md:block border-t border-white/10">
            {struttureAttive.length} strutture · {censimento.totale} elementi censiti
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
          {tab === "dashboard" && (
            <Dashboard
              stats={stats}
              censimento={censimento}
              manutenzioni={manutenzioniVisibili}
              utenteCorrente={utenteCorrente}
              luogoLabel={luogoLabel}
              onApri={(m) => setModale({ type: "modificaManutenzione", payload: m })}
              onNuova={() => setModale({ type: "nuovaManutenzione", payload: null })}
              onVaiCensimento={() => setTab("censimento")}
              onVaiApprovazioni={() => setTab("approvazioni")}
              puoApprovare={puoApprovare}
              onFiltroRapido={apriFiltroRapido}
            />
          )}

          {tab === "manutenzioni" && (
            <Manutenzioni
              manutenzioni={manutenzioni}
              filtroRapido={filtroRapido}
              strutture={struttureAttive}
              manutentori={manutentori}
              utenteCorrente={manutentori.find((m) => m.id === utenteCorrenteId) || null}
              luogoLabel={luogoLabel}
              cambiaStato={cambiaStato}
              onApri={(m) => setModale({ type: "modificaManutenzione", payload: m })}
              onNuova={() => setModale({ type: "nuovaManutenzione", payload: null })}
            />
          )}

          {tab === "report" && isAdminApp && (
            <Report
              manutenzioni={manutenzioni}
              manutentori={manutentori}
              ditte={ditte}
              tempiRegistrati={tempiRegistrati}
              materiali={materiali}
              luogoLabel={luogoLabel}
              onApri={(m) => setModale({ type: "modificaManutenzione", payload: m })}
            />
          )}

          {tab === "calendario" && (
            <Calendario
              manutenzioni={manutenzioni}
              strutture={struttureAttive}
              utenteCorrente={manutentori.find((m) => m.id === utenteCorrenteId) || null}
              luogoLabel={luogoLabel}
              onApri={(m) => setModale({ type: "modificaManutenzione", payload: m })}
            />
          )}

          {tab === "approvazioni" && puoApprovare && (
            <Approvazioni
              manutenzioni={manutenzioni}
              manutentori={manutentori}
              ditte={ditte}
              tempiRegistrati={tempiRegistrati}
              luogoLabel={luogoLabel}
              cambiaStato={cambiaStato}
              onApri={(m) => setModale({ type: "modificaManutenzione", payload: m })}
            />
          )}

          {tab === "censimento" && (
            <Censimento
              strutture={struttureAttive}
              zoneDi={zoneDi}
              camereDi={camereDi}
              oggettiDi={oggettiDi}
              aggiungiOggetto={aggiungiOggetto}
              eliminaOggetto={eliminaOggetto}
              segnaVerificato={segnaVerificato}
              creaInterventoDaOggetto={creaInterventoDaOggetto}
              censimento={censimento}
            />
          )}

          {tab === "team" && (
            <Team
              manutentori={manutentori}
              ditte={ditte}
              figureProfessionali={figureProfessionali}
              strutture={struttureAttive}
              manutenzioni={manutenzioni}
              tempiRegistrati={tempiRegistrati}
              utenteCorrente={manutentori.find((m) => m.id === utenteCorrenteId) || null}
              luogoLabel={luogoLabel}
              cambiaStato={cambiaStato}
              onNuovo={() => setModale({ type: "nuovoManutentore", payload: null })}
              onApri={(m) => setModale({ type: "modificaManutentore", payload: m })}
              onApriIntervento={(m) => setModale({ type: "modificaManutenzione", payload: m })}
            />
          )}

          {tab === "ditte" && (
            <DitteEsterne
              ditte={ditte}
              manutentori={manutentori}
              figureProfessionali={figureProfessionali}
              strutture={struttureAttive}
              onNuova={() => setModale({ type: "nuovaDitta", payload: null })}
              onApri={(d) => setModale({ type: "modificaDitta", payload: d })}
              onNuovoTecnico={nuovoTecnicoPerDitta}
              onApriTecnico={(m) => setModale({ type: "modificaManutentore", payload: m })}
            />
          )}

          {tab === "figure" && (
            <FigureProfessionali
              figureProfessionali={figureProfessionali}
              ditte={ditte}
              onAggiungi={aggiungiFiguraProfessionale}
              onElimina={eliminaFiguraProfessionale}
            />
          )}

          {tab === "strutture" && (
            <Anagrafica
              strutture={struttureAttive}
              zoneDi={zoneDi}
              camereDi={camereDi}
              oggettiDi={oggettiDi}
              aggiungiStruttura={aggiungiStruttura}
              eliminaStruttura={eliminaStruttura}
              aggiungiZona={aggiungiZona}
              aggiungiCamera={aggiungiCamera}
              aggiungiOggetto={aggiungiOggetto}
              eliminaZona={eliminaZona}
              eliminaCamera={eliminaCamera}
              eliminaOggetto={eliminaOggetto}
            />
          )}
        </main>
      </div>

      {(modale?.type === "nuovaManutenzione" || modale?.type === "modificaManutenzione") && (
        <ManutenzioneForm
          esistente={modale.payload}
          prefill={modale.prefill}
          strutture={struttureAttive}
          zoneDi={zoneDi}
          camereDi={camereDi}
          oggettiDi={oggettiDi}
          manutentori={manutentori}
          ditte={ditte}
          utenteCorrente={utenteCorrente}
          tempiRegistrati={tempiRegistrati}
          materialiElenco={materiali}
          storicoElenco={storicoModifiche}
          onSalva={salvaManutenzione}
          onElimina={eliminaManutenzione}
          onClose={() => setModale(null)}
        />
      )}

      {(modale?.type === "nuovoManutentore" || modale?.type === "modificaManutentore") && (
        <ManutentoreForm
          esistente={modale.payload}
          prefill={modale.prefillManutentore}
          strutture={struttureAttive}
          ditte={ditte}
          manutentori={manutentori}
          figureProfessionali={figureProfessionali}
          onSalva={salvaManutentore}
          onElimina={eliminaManutentore}
          onClose={() => setModale(null)}
        />
      )}

      {(modale?.type === "nuovaDitta" || modale?.type === "modificaDitta") && (
        <DittaForm
          esistente={modale.payload}
          strutture={struttureAttive}
          manutentori={manutentori}
          figureProfessionali={figureProfessionali}
          onSalva={salvaDitta}
          onElimina={eliminaDitta}
          onClose={() => setModale(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                           */
/* ------------------------------------------------------------------ */

function Dashboard({ stats, censimento, manutenzioni, luogoLabel, onApri, onNuova, onVaiCensimento, onVaiApprovazioni, puoApprovare, onFiltroRapido }: {
  stats: { aperte: number; urgenti: number; scadute: number; programmate: number; inApprovazione: number };
  censimento: { totale: number; daVerificare: number; criticita: number; verificati: number; percVerificato: number };
  manutenzioni: Manutenzione[];
  luogoLabel: (m: Manutenzione) => string;
  onApri: (m: Manutenzione) => void;
  onNuova: () => void;
  onVaiCensimento: () => void;
  onVaiApprovazioni: () => void;
  puoApprovare: boolean;
  onFiltroRapido: (tipo: string) => void;
}) {
  const inScadenza = manutenzioni
    .filter((m) => m.stato !== "Completata" && m.stato !== "Annullata")
    .slice()
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
    .slice(0, 6);

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl md:text-[28px] font-semibold text-stone-900">Cruscotto manutenzioni</h1>
          <p className="text-stone-500 text-sm mt-1">Gruppo Urban Homy · tutte le strutture</p>
        </div>
        <button onClick={onNuova} className="flex items-center gap-2 bg-[#C1622D] hover:bg-[#a9531f] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo intervento
        </button>
      </header>

      <div className={`grid grid-cols-2 ${puoApprovare ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3 mb-6`}>
        <StatCard label="Ordini aperti" value={stats.aperte} icon={ClipboardList} accent="bg-[#1B2430]" onClick={() => onFiltroRapido("aperti")} />
        <StatCard label="Alta priorità" value={stats.urgenti} icon={AlertTriangle} accent="bg-[#C1622D]" onClick={() => onFiltroRapido("urgenti")} />
        <StatCard label="Scaduti" value={stats.scadute} icon={Clock3} accent="bg-rose-600" onClick={() => onFiltroRapido("scaduti")} />
        <StatCard label="Programmati attivi" value={stats.programmate} icon={Repeat} accent="bg-teal-600" onClick={() => onFiltroRapido("programmati")} />
        {puoApprovare && <StatCard label="In approvazione" value={stats.inApprovazione} icon={ShieldCheck} accent="bg-amber-500" onClick={onVaiApprovazioni} />}
      </div>

      <button onClick={onVaiCensimento} className="w-full text-left bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 mb-6 flex items-center gap-4 hover:border-[#C1622D]/50 transition">
        <div className="w-11 h-11 rounded-lg bg-[#1B2430] flex items-center justify-center shrink-0">
          <ClipboardCheck size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="font-[Fraunces] font-semibold text-stone-900">Censimento in corso</div>
          <div className="text-xs text-stone-500 mt-0.5">
            {censimento.verificati} di {censimento.totale} elementi verificati · {censimento.criticita} criticità rilevate
          </div>
        </div>
        <div className="w-32 h-2 rounded-full bg-stone-100 overflow-hidden hidden sm:block">
          <div className="h-full bg-[#C1622D]" style={{ width: `${censimento.percVerificato}%` }} />
        </div>
        <span className="text-xs font-semibold text-[#C1622D] shrink-0">{censimento.percVerificato}%</span>
      </button>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-[Fraunces] font-semibold text-stone-900">Prossime scadenze</h2>
          <span className="text-xs text-stone-400">ordinate per scadenza</span>
        </div>
        <ul className="divide-y divide-stone-100">
          {inScadenza.length === 0 && <li className="px-5 py-6 text-sm text-stone-400">Nessun intervento aperto. Tutto sotto controllo.</li>}
          {inScadenza.map((m) => {
            const scaduta = isScaduta(m);
            const StatoIcon = statoIcon[m.stato];
            return (
              <li key={m.id} onClick={() => onApri(m)} className="px-5 py-3.5 flex items-center gap-4 hover:bg-stone-50 cursor-pointer transition">
                <span className={`w-2 h-2 rounded-full ${priDot[m.priorita]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-900 truncate">{m.titolo}</span>
                    {m.tipo === "programmata" && <Repeat size={12} className="text-teal-600 shrink-0" />}
                  </div>
                  <div className="text-xs text-stone-500 truncate">{luogoLabel(m)}</div>
                </div>
                <span className={`text-xs font-mono-tag ${scaduta ? "text-rose-600 font-semibold" : "text-stone-500"}`}>{fmtData(m.scadenza)}</span>
                <Tag className={statoColor[m.stato] + " border-transparent"}>
                  <StatoIcon size={11} /> {m.stato}
                </Tag>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ELENCO MANUTENZIONI                                                 */
/* ------------------------------------------------------------------ */

const FILTRO_RAPIDO_LABEL = {
  aperti: "Ordini aperti",
  urgenti: "Alta priorità",
  scaduti: "Scaduti",
  programmati: "Programmati attivi",
};

function matchFiltroRapido(m: Manutenzione, tipo: string): boolean {
  switch (tipo) {
    case "aperti":
      return m.stato === "Da fare" || m.stato === "Presa in carico" || m.stato === "In corso";
    case "urgenti":
      return (m.priorita === "Urgente" || m.priorita === "Alta") && m.stato !== "Completata" && m.stato !== "Annullata";
    case "scaduti":
      return isScaduta(m);
    case "programmati":
      return m.tipo === "programmata" && m.stato !== "Completata" && m.stato !== "Annullata";
    default:
      return true;
  }
}

function Manutenzioni({ manutenzioni, filtroRapido, strutture, manutentori, utenteCorrente, luogoLabel, cambiaStato, onApri, onNuova }: {
  manutenzioni: Manutenzione[];
  filtroRapido: { tipo: string; token: number } | null;
  strutture: Struttura[];
  manutentori: Manutentore[];
  utenteCorrente: Manutentore | null;
  luogoLabel: (m: Manutenzione) => string;
  cambiaStato: (id: string, stato: string) => void;
  onApri: (m: Manutenzione) => void;
  onNuova: () => void;
}) {
  const [filtroStruttura, setFiltroStruttura] = useState<string>("");
  const [filtroStato, setFiltroStato] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroTipoManutentore, setFiltroTipoManutentore] = useState<string>("");
  const [filtroManutentore, setFiltroManutentore] = useState<string>("");
  const [ricerca, setRicerca] = useState<string>("");
  const [filtroRapidoAttivo, setFiltroRapidoAttivo] = useState<{ tipo: string; token: number } | null>(filtroRapido);

  useEffect(() => {
    if (filtroRapido) setFiltroRapidoAttivo(filtroRapido);
  }, [filtroRapido]);

  const tipoManutentoreOf = (id) => manutentori.find((mm) => mm.id === id)?.tipo || null;

  // Permesso: un tecnico esterno può essere limitato a vedere solo i propri interventi assegnati
  const accessoLimitato = !!(utenteCorrente && utenteCorrente.tipo === "Esterno" && utenteCorrente.visibilita === "assegnati");

  // Vista rapida derivata dai filtri attivi, disponibile quando si è "loggati" come un manutentore
  const vista = accessoLimitato
    ? "miei"
    : utenteCorrente
    ? (filtroManutentore === utenteCorrente.id
        ? "miei"
        : (filtroTipoManutentore === utenteCorrente.tipo && !filtroManutentore ? "tipologia" : "tutti"))
    : "tutti";

  function impostaVista(v) {
    if (v === "miei" && utenteCorrente) {
      setFiltroManutentore(utenteCorrente.id);
      setFiltroTipoManutentore(utenteCorrente.tipo);
    } else if (v === "tipologia" && utenteCorrente) {
      setFiltroManutentore("");
      setFiltroTipoManutentore(utenteCorrente.tipo);
    } else {
      setFiltroManutentore("");
      setFiltroTipoManutentore("");
    }
  }

  const assegnatariUnici = useMemo(() => {
    const map = new Map();
    manutenzioni.forEach((m) => {
      if (!m.assegnatoId) return;
      const mm = manutentori.find((x) => x.id === m.assegnatoId);
      if (mm) map.set(m.assegnatoId, { key: m.assegnatoId, label: mm.nome, tipo: mm.tipo });
    });
    return Array.from(map.values())
      .filter((a) => !filtroTipoManutentore || a.tipo === filtroTipoManutentore)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [manutenzioni, manutentori, filtroTipoManutentore]);

  const elenco = manutenzioni
    .filter((m) => !accessoLimitato || m.assegnatoId === utenteCorrente.id)
    .filter((m) => !filtroRapidoAttivo || matchFiltroRapido(m, filtroRapidoAttivo.tipo))
    .filter((m) => !filtroStruttura || m.strutturaId === filtroStruttura)
    .filter((m) => !filtroStato || m.stato === filtroStato)
    .filter((m) => !filtroTipo || m.tipo === filtroTipo)
    .filter((m) => accessoLimitato || !filtroTipoManutentore || tipoManutentoreOf(m.assegnatoId) === filtroTipoManutentore)
    .filter((m) => accessoLimitato || !filtroManutentore || m.assegnatoId === filtroManutentore)
    .filter((m) => !ricerca || (m.titolo + m.descrizione).toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Interventi</h1>
          <p className="text-stone-500 text-sm mt-1">
            {utenteCorrente ? <>Connesso come <span className="font-semibold text-stone-700">{utenteCorrente.nome}</span> · {utenteCorrente.tipo}</> : "Riparazioni singole e manutenzioni programmate"}
          </p>
        </div>
        <button onClick={onNuova} className="flex items-center gap-2 bg-[#C1622D] hover:bg-[#a9531f] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo intervento
        </button>
      </header>

      {filtroRapidoAttivo && (
        <div className="flex items-center gap-2 mb-4 bg-[#1B2430]/5 border border-[#1B2430]/20 text-stone-700 text-xs font-medium rounded-lg px-3.5 py-2.5">
          <Filter size={14} className="shrink-0 text-[#1B2430]" />
          Filtro rapido dal cruscotto: <span className="font-semibold">{FILTRO_RAPIDO_LABEL[filtroRapidoAttivo.tipo]}</span>
          <button onClick={() => setFiltroRapidoAttivo(null)} className="ml-auto flex items-center gap-1 text-stone-500 hover:text-stone-800">
            <X size={13} /> Rimuovi
          </button>
        </div>
      )}

      {accessoLimitato ? (
        <div className="flex items-center gap-2 mb-4 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium rounded-lg px-3.5 py-2.5">
          <ShieldAlert size={14} className="shrink-0" />
          Come ditta esterna con visibilità limitata, vedi solo gli interventi assegnati a te. L'amministratore può cambiare questo permesso nella scheda del manutentore.
        </div>
      ) : utenteCorrente ? (
        <div className="flex gap-2 mb-4">
          {[
            { id: "tutti", label: "Tutti gli interventi" },
            { id: "tipologia", label: `Solo ${utenteCorrente.tipo.toLowerCase()}` },
            { id: "miei", label: "I miei interventi" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => impostaVista(v.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
                vista === v.id ? "bg-[#1B2430] text-white border-[#1B2430]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-stone-400 mb-4 flex items-center gap-1.5">
          <UserCog size={13} /> Seleziona "Accesso come" nella barra laterale per vedere rapidamente solo i tuoi interventi o quelli della tua tipologia.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <Search size={15} className="text-stone-400 shrink-0" />
          <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per titolo o descrizione…" className="text-sm outline-none w-full bg-transparent" />
        </div>
        <select value={filtroStruttura} onChange={(e) => setFiltroStruttura(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutte le strutture</option>
          {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Singole e programmate</option>
          <option value="singola">Solo singole</option>
          <option value="programmata">Solo programmate</option>
        </select>
        <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti gli stati</option>
          {STATI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {!accessoLimitato && (
        <select
          value={filtroTipoManutentore}
          onChange={(e) => { setFiltroTipoManutentore(e.target.value); setFiltroManutentore(""); }}
          className={inputCls + " w-auto text-xs"}
        >
          <option value="">Interni ed esterni</option>
          <option value="Interno">Solo interni</option>
          <option value="Esterno">Solo esterni</option>
        </select>
        )}
        {!accessoLimitato && (
        <select value={filtroManutentore} onChange={(e) => setFiltroManutentore(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti i manutentori</option>
          {assegnatariUnici.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        )}
      </div>

      <div className="grid gap-3">
        {elenco.length === 0 && (
          <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
            Nessun intervento corrisponde ai filtri selezionati.
          </div>
        )}
        {elenco.map((m) => {
          const StatoIcon = statoIcon[m.stato];
          const scaduta = isScaduta(m);
          return (
            <div key={m.id} className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
              <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => onApri(m)}>
                <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "programmata" ? "bg-teal-50 text-teal-600" : "bg-[#C1622D]/10 text-[#C1622D]"}`}>
                  {m.tipo === "programmata" ? <Repeat size={16} /> : <Wrench size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-stone-900">{m.titolo}</span>
                    <Tag className={priColor[m.priorita]}>{m.priorita}</Tag>
                    {scaduta && <Tag className="bg-rose-600 text-white border-transparent">In ritardo</Tag>}
                    {m.foto?.length > 0 && <Tag className="bg-stone-50 text-stone-500 border-stone-300"><Camera size={10} /> {m.foto.length}</Tag>}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(m)}</div>
                  <div className="text-xs text-stone-400 mt-1 font-mono-tag">{m.id} · scadenza {fmtData(m.scadenza)}{m.ricorrenza ? ` · ogni ${m.ricorrenza.intervallo} ${m.ricorrenza.unita}` : ""}</div>
                  {m.foto?.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {m.foto.slice(0, 4).map((src, i) => (
                        <img key={i} src={src} alt="" className="w-10 h-10 rounded-md object-cover border border-stone-200" />
                      ))}
                      {m.foto.length > 4 && (
                        <span className="w-10 h-10 rounded-md border border-stone-200 bg-stone-50 flex items-center justify-center text-[10px] text-stone-500 font-semibold">
                          +{m.foto.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={m.stato}
                  onChange={(e) => cambiaStato(m.id, e.target.value)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer ${statoColor[m.stato]}`}
                >
                  {(utenteCorrente ? STATI.filter((s) => s !== "Completata") : STATI).map((s) => <option key={s} value={s} className="bg-white text-stone-800">{s}</option>)}
                </select>
                <button onClick={() => onApri(m)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500">
                  <Pencil size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CALENDARIO — vista mensile con filtro strutture                     */
/* ------------------------------------------------------------------ */

const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const GIORNI_SETT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function Calendario({ manutenzioni, strutture, utenteCorrente, luogoLabel, onApri }: {
  manutenzioni: Manutenzione[];
  strutture: Struttura[];
  utenteCorrente: Manutentore | null;
  luogoLabel: (m: Manutenzione) => string;
  onApri: (m: Manutenzione) => void;
}) {
  const [cursore, setCursore] = useState<Date>(new Date(oggi.getFullYear(), oggi.getMonth(), 1));
  const [filtroStruttura, setFiltroStruttura] = useState<string>("");
  const [giornoSel, setGiornoSel] = useState<string | null>(null);

  const anno = cursore.getFullYear();
  const mese = cursore.getMonth();

  const accessoLimitato = !!(utenteCorrente && utenteCorrente.tipo === "Esterno" && utenteCorrente.visibilita === "assegnati");

  const elenco = manutenzioni
    .filter((m) => !accessoLimitato || m.assegnatoId === utenteCorrente.id)
    .filter((m) => !filtroStruttura || m.strutturaId === filtroStruttura);

  const perGiorno = useMemo(() => {
    const map = {};
    elenco.forEach((m) => {
      (map[m.scadenza] = map[m.scadenza] || []).push(m);
    });
    return map;
  }, [elenco]);

  const primoDelMese = new Date(anno, mese, 1);
  const offsetLunedi = (primoDelMese.getDay() + 6) % 7; // 0 = lunedì
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  const celle = [];
  for (let i = 0; i < offsetLunedi; i++) celle.push(null);
  for (let d = 1; d <= giorniNelMese; d++) celle.push(d);

  const isoGiorno = (d) => `${anno}-${String(mese + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const isOggi = (d) => isoGiorno(d) === oggi.toISOString().slice(0, 10);

  const eventiGiornoSel = giornoSel ? (perGiorno[giornoSel] || []) : [];

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Calendario</h1>
          <p className="text-stone-500 text-sm mt-1">
            {accessoLimitato ? "Vedi solo le scadenze dei tuoi interventi assegnati" : "Scadenze di riparazioni singole e manutenzioni programmate"}
          </p>
        </div>
        <select value={filtroStruttura} onChange={(e) => { setFiltroStruttura(e.target.value); setGiornoSel(null); }} className={inputCls + " w-auto text-sm font-semibold"}>
          <option value="">Tutte le strutture</option>
          {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
            <button onClick={() => { setCursore(new Date(anno, mese - 1, 1)); setGiornoSel(null); }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500">
              <ChevronLeft size={18} />
            </button>
            <div className="font-[Fraunces] font-semibold text-stone-900">{MESI[mese]} {anno}</div>
            <button onClick={() => { setCursore(new Date(anno, mese + 1, 1)); setGiornoSel(null); }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-100 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            {GIORNI_SETT.map((g) => <div key={g} className="px-2 py-2 text-center">{g}</div>)}
          </div>

          <div className="grid grid-cols-7">
            {celle.map((d, i) => {
              if (d === null) return <div key={i} className="min-h-[86px] border-b border-r border-stone-100 bg-stone-50/40" />;
              const iso = isoGiorno(d);
              const eventi = perGiorno[iso] || [];
              const haUrgenti = eventi.some((m) => (m.priorita === "Urgente" || isScaduta(m)) && m.stato !== "Completata" && m.stato !== "Annullata");
              return (
                <button
                  key={i}
                  onClick={() => setGiornoSel(iso === giornoSel ? null : iso)}
                  className={`min-h-[86px] border-b border-r border-stone-100 p-1.5 text-left align-top flex flex-col gap-1 transition ${
                    giornoSel === iso ? "bg-[#C1622D]/10" : "hover:bg-stone-50"
                  }`}
                >
                  <span className={`text-xs font-mono-tag w-5 h-5 flex items-center justify-center rounded-full ${isOggi(d) ? "bg-[#1B2430] text-white" : "text-stone-500"}`}>{d}</span>
                  <div className="flex flex-col gap-0.5">
                    {eventi.slice(0, 2).map((m) => (
                      <span key={m.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${priColor[m.priorita]}`}>
                        {m.titolo}
                      </span>
                    ))}
                    {eventi.length > 2 && <span className="text-[10px] text-stone-400">+{eventi.length - 2} altri</span>}
                  </div>
                  {haUrgenti && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 self-end mt-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4 lg:sticky lg:top-6">
          <div className="font-[Fraunces] font-semibold text-stone-900 mb-3">
            {giornoSel ? fmtData(giornoSel) : "Seleziona un giorno"}
          </div>
          {!giornoSel && <p className="text-sm text-stone-400">Clicca su una data nel calendario per vedere gli interventi in scadenza quel giorno.</p>}
          {giornoSel && eventiGiornoSel.length === 0 && <p className="text-sm text-stone-400">Nessun intervento in scadenza.</p>}
          <div className="grid gap-2">
            {eventiGiornoSel.map((m) => {
              const StatoIcon = statoIcon[m.stato];
              return (
                <button key={m.id} onClick={() => onApri(m)} className="text-left border border-stone-200 rounded-lg px-3 py-2.5 hover:border-[#C1622D]/50 transition">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-stone-900">{m.titolo}</span>
                    {m.tipo === "programmata" && <Repeat size={11} className="text-teal-600" />}
                  </div>
                  <div className="text-xs text-stone-500 mb-1.5">{luogoLabel(m)}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tag className={priColor[m.priorita]}>{m.priorita}</Tag>
                    <Tag className={statoColor[m.stato] + " border-transparent"}><StatoIcon size={10} /> {m.stato}</Tag>
                    {m.foto?.length > 0 && <Tag className="bg-stone-50 text-stone-500 border-stone-300"><Camera size={10} /> {m.foto.length}</Tag>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APPROVAZIONI — interventi completati in attesa di verifica          */
/* ------------------------------------------------------------------ */

function Approvazioni({ manutenzioni, manutentori, ditte, tempiRegistrati, luogoLabel, cambiaStato, onApri }: {
  manutenzioni: Manutenzione[];
  manutentori: Manutentore[];
  ditte: Ditta[];
  tempiRegistrati: TempoRegistrato[];
  luogoLabel: (m: Manutenzione) => string;
  cambiaStato: (id: string, stato: string) => void;
  onApri: (m: Manutenzione) => void;
}) {
  const elenco = manutenzioni
    .filter((m) => m.stato === "In accettazione")
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));

  const approvatoreDi = (m) => {
    const tecnico = manutentori.find((x) => x.id === m.assegnatoId);
    if (!tecnico || tecnico.tipo !== "Esterno") return null;
    const ditta = ditte.find((d) => d.id === tecnico.dittaId);
    return ditta ? nomeManutentoreId(ditta.approvatoreId, manutentori) : null;
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Approvazioni</h1>
        <p className="text-stone-500 text-sm mt-1">Interventi segnati come completati, in attesa di verifica e approvazione</p>
      </header>

      {elenco.length === 0 ? (
        <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
          Nessun intervento in attesa di approvazione.
        </div>
      ) : (
        <div className="grid gap-3">
          {elenco.map((m) => (
            <div key={m.id} className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 cursor-pointer" onClick={() => onApri(m)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-stone-900">{m.titolo}</span>
                    <Tag className={priColor[m.priorita]}>{m.priorita}</Tag>
                    {tempoTotale(m.id, tempiRegistrati) > 0 && <Tag className="bg-teal-50 text-teal-700 border-teal-300"><Clock3 size={9} /> {fmtDurata(tempoTotale(m.id, tempiRegistrati))}</Tag>}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(m)} · assegnato a {nomeManutentoreId(m.assegnatoId, manutentori) || "—"}</div>
                  <div className="text-xs text-stone-400 mt-1 font-mono-tag">{m.id} · scadenza {fmtData(m.scadenza)}</div>
                  <div className="text-xs text-amber-700 mt-1 font-medium">Da approvare da: {approvatoreDi(m) || "Amministrazione interna"}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => cambiaStato(m.id, "In corso")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-stone-300 text-stone-600 hover:bg-stone-100 transition"
                  >
                    <RotateCcw size={14} /> Rifiuta
                  </button>
                  <button
                    onClick={() => cambiaStato(m.id, "Completata")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                  >
                    <CheckCircle2 size={14} /> Approva
                  </button>
                </div>
              </div>
              {m.notaChiusura && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Nota di chiusura</div>
                  <p className="text-xs text-stone-600 mt-0.5">{m.notaChiusura}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  REPORT — interventi approvati nel mese e fatture da ricevere        */
/* ------------------------------------------------------------------ */

function Report({ manutenzioni, manutentori, ditte, tempiRegistrati, materiali, luogoLabel, onApri }: {
  manutenzioni: Manutenzione[];
  manutentori: Manutentore[];
  ditte: Ditta[];
  tempiRegistrati: TempoRegistrato[];
  materiali: Materiale[];
  luogoLabel: (m: Manutenzione) => string;
  onApri: (m: Manutenzione) => void;
}) {
  const [mese, setMese] = useState<string>(oggi.toISOString().slice(0, 7));

  const tecnicoDi = (id) => manutentori.find((m) => m.id === id) || null;
  const dittaDi = (tecnico) => (tecnico && tecnico.tipo === "Esterno" && tecnico.dittaId ? ditte.find((d) => d.id === tecnico.dittaId) || null : null);

  // Solo la tariffa che corrisponde esattamente alla figura professionale del
  // tecnico, e non scaduta, è valida: niente fallback su "la prima della
  // lista" che produrrebbe un costo plausibile ma sbagliato.
  const tariffaApplicabile = (tecnico, ditta) => {
    if (!ditta) return null;
    const tariffa = (ditta.tariffe || []).find((t) => t.figuraProfessionaleId === tecnico.figuraProfessionaleId);
    if (!tariffa || tariffaScaduta(tariffa)) return null;
    return tariffa;
  };
  const tariffaMancante = (m) => {
    const tecnico = tecnicoDi(m.assegnatoId);
    const ditta = dittaDi(tecnico);
    return !!ditta && !tariffaApplicabile(tecnico, ditta);
  };
  const costoManodopera = (m) => {
    const tecnico = tecnicoDi(m.assegnatoId);
    const ditta = dittaDi(tecnico);
    const tariffa = tariffaApplicabile(tecnico, ditta);
    if (!tariffa) return 0;
    return (tempoTotale(m.id, tempiRegistrati) / 60) * tariffa.tariffaOraria;
  };
  const costoMateriali = (m) => materiali.filter((mt) => mt.manutenzioneId === m.id).reduce((s, mt) => s + mt.quantita * mt.costoUnitario, 0);
  const costoTotale = (m) => costoManodopera(m) + costoMateriali(m);

  const completatiMese = useMemo(
    () => manutenzioni.filter((m) => m.stato === "Completata" && m.dataApprovazione && m.dataApprovazione.slice(0, 7) === mese),
    [manutenzioni, mese]
  );

  const daFatturare = useMemo(
    () => completatiMese.filter((m) => dittaDi(tecnicoDi(m.assegnatoId))),
    [completatiMese, manutentori, ditte]
  );
  const interni = completatiMese.filter((m) => !daFatturare.includes(m));

  const gruppiDitta = useMemo(() => {
    const gruppi = {};
    daFatturare.forEach((m) => {
      const ditta = dittaDi(tecnicoDi(m.assegnatoId));
      const key = ditta.id;
      if (!gruppi[key]) gruppi[key] = { ditta, interventi: [] };
      gruppi[key].interventi.push(m);
    });
    return Object.values(gruppi).sort((a, b) => a.ditta.ragioneSociale.localeCompare(b.ditta.ragioneSociale));
  }, [daFatturare]);

  const totaleStimato = daFatturare.reduce((s, m) => s + costoTotale(m), 0);

  const cambiaMese = (delta) => {
    const [y, mo] = mese.split("-").map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    setMese(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const etichettaMese = (() => {
    const [y, mo] = mese.split("-").map(Number);
    const label = new Date(y, mo - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Report</h1>
          <p className="text-stone-500 text-sm mt-1">Interventi approvati nel mese e riepilogo delle fatture da ricevere dalle ditte esterne</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-stone-300 rounded-lg px-1 py-1">
          <button type="button" onClick={() => cambiaMese(-1)} className="p-1.5 text-stone-500 hover:bg-stone-100 rounded-md">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-stone-700 px-2 min-w-[140px] text-center">{etichettaMese}</span>
          <button type="button" onClick={() => cambiaMese(1)} className="p-1.5 text-stone-500 hover:bg-stone-100 rounded-md">
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Approvati nel mese" value={completatiMese.length} icon={CheckCircle2} accent="bg-[#1B2430]" />
        <StatCard label="Da fatturare (esterni)" value={daFatturare.length} icon={Receipt} accent="bg-amber-500" />
        <StatCard label="Interni (non fatturabili)" value={interni.length} icon={UserCog} accent="bg-teal-600" />
        <StatCard label="Totale stimato" value={`€ ${totaleStimato.toFixed(2)}`} icon={FileText} accent="bg-[#C1622D]" />
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2.5 flex items-center gap-1.5">
        <Receipt size={14} /> Fatture da ricevere · per ditta esterna
      </h2>
      {gruppiDitta.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl mb-6">
          Nessun intervento esterno approvato in questo mese.
        </div>
      ) : (
        <div className="grid gap-3 mb-6">
          {gruppiDitta.map(({ ditta, interventi }) => {
            const totaleDitta = interventi.reduce((s, m) => s + costoTotale(m), 0);
            return (
              <div key={ditta.id} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-stone-50 border-b border-stone-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Briefcase size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-sm text-stone-800 truncate">{ditta.ragioneSociale}</span>
                    <Tag className="bg-stone-100 text-stone-500 border-stone-300">{interventi.length} {interventi.length === 1 ? "intervento" : "interventi"}</Tag>
                  </div>
                  <span className="font-mono-tag text-sm font-semibold text-stone-800 shrink-0">€ {totaleDitta.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {interventi.map((m) => (
                    <button key={m.id} type="button" onClick={() => onApri(m)} className="w-full text-left px-5 py-3 hover:bg-stone-50 transition flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-800 truncate">{m.titolo}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(m)} · assegnato a {nomeManutentoreId(m.assegnatoId, manutentori) || "—"} · approvato il {fmtData(m.dataApprovazione)}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        {tempoTotale(m.id, tempiRegistrati) > 0 && <Tag className="bg-teal-50 text-teal-700 border-teal-300"><Clock3 size={9} /> {fmtDurata(tempoTotale(m.id, tempiRegistrati))}</Tag>}
                        {tariffaMancante(m) && (
                          <Tag className="bg-rose-50 text-rose-700 border-rose-300" title="Nessuna tariffa valida per la figura professionale del tecnico: il costo manodopera è 0 finché non viene aggiunta o rinnovata in Ditte esterne.">
                            <AlertTriangle size={9} /> Tariffa mancante
                          </Tag>
                        )}
                        <span className="font-mono-tag text-stone-600">manodopera € {costoManodopera(m).toFixed(2)}</span>
                        <span className="font-mono-tag text-stone-600">materiali € {costoMateriali(m).toFixed(2)}</span>
                        <span className="font-mono-tag font-semibold text-stone-800">€ {costoTotale(m).toFixed(2)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2.5 flex items-center gap-1.5">
        <UserCog size={14} /> Interventi interni completati · non generano fatture
      </h2>
      {interni.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
          Nessun intervento interno approvato in questo mese.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm divide-y divide-stone-100">
          {interni.map((m) => (
            <button key={m.id} type="button" onClick={() => onApri(m)} className="w-full text-left px-5 py-3 hover:bg-stone-50 transition flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-800 truncate">{m.titolo}</div>
                <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(m)} · assegnato a {nomeManutentoreId(m.assegnatoId, manutentori) || "—"} · approvato il {fmtData(m.dataApprovazione)}</div>
              </div>
              {tempoTotale(m.id, tempiRegistrati) > 0 && <Tag className="bg-teal-50 text-teal-700 border-teal-300 shrink-0"><Clock3 size={9} /> {fmtDurata(tempoTotale(m.id, tempiRegistrati))}</Tag>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TEAM — censimento manutentori interni ed esterni                    */
/* ------------------------------------------------------------------ */

function Team({ manutentori, ditte, figureProfessionali, strutture, manutenzioni, tempiRegistrati, utenteCorrente, luogoLabel, cambiaStato, onNuovo, onApri, onApriIntervento }: {
  manutentori: Manutentore[];
  ditte: Ditta[];
  figureProfessionali: FiguraProfessionale[];
  strutture: Struttura[];
  manutenzioni: Manutenzione[];
  tempiRegistrati: TempoRegistrato[];
  utenteCorrente: Manutentore | null;
  luogoLabel: (m: Manutenzione) => string;
  cambiaStato: (id: string, stato: string) => void;
  onNuovo: () => void;
  onApri: (m: Manutentore) => void;
  onApriIntervento: (m: Manutenzione) => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [ricerca, setRicerca] = useState<string>("");
  const [vista, setVista] = useState<string>("tutti"); // 'tutti' | 'mio'

  const dittaOf = (id) => ditte.find((d) => d.id === id) || null;
  const figuraOf = (id) => figureProfessionali.find((f) => f.id === id)?.nome || "";

  const interventiDi = (id) => manutenzioni.filter((m) => m.assegnatoId === id);
  const interventiAperti = (id) => interventiDi(id).filter((m) => m.stato !== "Completata" && m.stato !== "Annullata").length;
  const tempoTotaleDi = (id) =>
    tempiRegistrati.filter((t) => t.manutentoreId === id).reduce((s, t) => s + (t.minuti || 0), 0);

  const elenco = manutentori
    .filter((m) => !m.eliminato)
    .filter((m) => !filtroTipo || m.tipo === filtroTipo)
    .filter((m) => !ricerca || (m.nome + " " + figuraOf(m.figuraProfessionaleId) + " " + (dittaOf(m.dittaId)?.ragioneSociale || "")).toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const strutturaLabel = (ids) => (!ids || ids.length === 0 ? "Tutte le strutture" : ids.map((id) => strutture.find((s) => s.id === id)?.nome).filter(Boolean).join(", "));

  const mostraSoloMio = vista === "mio" && !!utenteCorrente;
  const interventiMiei = utenteCorrente
    ? interventiDi(utenteCorrente.id).slice().sort((a, b) => a.scadenza.localeCompare(b.scadenza))
    : [];

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Manutentori</h1>
          <p className="text-stone-500 text-sm mt-1">
            {utenteCorrente ? <>Connesso come <span className="font-semibold text-stone-700">{utenteCorrente.nome}</span> · {utenteCorrente.tipo}</> : "Censimento del personale interno e delle ditte esterne"}
          </p>
        </div>
        <button onClick={onNuovo} className="flex items-center gap-2 bg-[#C1622D] hover:bg-[#a9531f] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo manutentore
        </button>
      </header>

      {utenteCorrente ? (
        <div className="flex items-center gap-5 mb-4 bg-white border border-stone-200 rounded-xl px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700 cursor-pointer select-none">
            <input type="radio" name="vistaTeam" value="tutti" checked={vista === "tutti"} onChange={() => setVista("tutti")} className="accent-[#C1622D]" />
            Tutti i manutentori
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700 cursor-pointer select-none">
            <input type="radio" name="vistaTeam" value="mio" checked={vista === "mio"} onChange={() => setVista("mio")} className="accent-[#C1622D]" />
            Solo i miei interventi
          </label>
        </div>
      ) : (
        <div className="text-xs text-stone-400 mb-4 flex items-center gap-1.5">
          <UserCog size={13} /> Seleziona "Accesso come" nella barra laterale per filtrare solo i tuoi interventi.
        </div>
      )}

      {mostraSoloMio ? (
        <div className="grid gap-3">
          {interventiMiei.length === 0 && (
            <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
              Nessun intervento assegnato a {utenteCorrente.nome}.
            </div>
          )}
          {interventiMiei.map((m) => {
            const StatoIcon = statoIcon[m.stato];
            const scaduta = isScaduta(m);
            return (
              <div key={m.id} className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
                <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => onApriIntervento(m)}>
                  <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "programmata" ? "bg-teal-50 text-teal-600" : "bg-[#C1622D]/10 text-[#C1622D]"}`}>
                    {m.tipo === "programmata" ? <Repeat size={16} /> : <Wrench size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-stone-900">{m.titolo}</span>
                      <Tag className={priColor[m.priorita]}>{m.priorita}</Tag>
                      {scaduta && <Tag className="bg-rose-600 text-white border-transparent">In ritardo</Tag>}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(m)}</div>
                    <div className="text-xs text-stone-400 mt-1 font-mono-tag">scadenza {fmtData(m.scadenza)}{m.ricorrenza ? ` · ogni ${m.ricorrenza.intervallo} ${m.ricorrenza.unita}` : ""}</div>
                  </div>
                </div>
                <select
                  value={m.stato}
                  onChange={(e) => cambiaStato(m.id, e.target.value)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer shrink-0 ${statoColor[m.stato]}`}
                >
                  {(utenteCorrente ? STATI.filter((s) => s !== "Completata") : STATI).map((s) => <option key={s} value={s} className="bg-white text-stone-800">{s}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <Search size={15} className="text-stone-400 shrink-0" />
              <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per nome, ruolo o specializzazione…" className="text-sm outline-none w-full bg-transparent" />
            </div>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={inputCls + " w-auto text-xs"}>
              <option value="">Interni ed esterni</option>
              <option value="Interno">Solo interni</option>
              <option value="Esterno">Solo esterni</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {elenco.length === 0 && (
              <div className="sm:col-span-2 text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
                Nessun manutentore corrisponde ai filtri selezionati.
              </div>
            )}
            {elenco.map((m) => {
              const aperti = interventiAperti(m.id);
              const tempoTot = tempoTotaleDi(m.id);
              const ditta = dittaOf(m.dittaId);
              return (
                <button key={m.id} onClick={() => onApri(m)} className="text-left bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 hover:border-[#C1622D]/50 transition">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "Interno" ? "bg-teal-50 text-teal-600" : "bg-[#C1622D]/10 text-[#C1622D]"}`}>
                      {m.tipo === "Interno" ? <UserCog size={18} /> : <Users size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-stone-900">{m.nome}</span>
                        {!m.attivo && <Tag className="bg-stone-100 text-stone-500 border-stone-300">Non attivo</Tag>}
                        {m.attivo && m.tipo === "Esterno" && !manutentoreDisponibile(m, ditte) && (
                          <Tag className="bg-rose-50 text-rose-700 border-rose-300">
                            <ShieldAlert size={9} /> {!m.dittaId ? "Nessuna ditta collegata" : !ditta?.attivo ? "Ditta non attiva" : "Contratto scaduto"}
                          </Tag>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {figuraOf(m.figuraProfessionaleId)}{ditta && <span className="text-stone-400"> · {ditta.ragioneSociale}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Tag className={m.tipo === "Interno" ? "bg-teal-50 text-teal-700 border-teal-300" : "bg-[#C1622D]/10 text-[#C1622D] border-[#C1622D]/30"}>{m.tipo}</Tag>
                        {ditta && <Tag className="bg-stone-50 text-stone-500 border-stone-300"><Briefcase size={9} /> {ditta.ragioneSociale}</Tag>}
                        {m.tipo === "Esterno" && (
                          <Tag className={m.visibilita === "assegnati" ? "bg-amber-50 text-amber-800 border-amber-400" : "bg-teal-50 text-teal-700 border-teal-300"}>
                            {m.visibilita === "assegnati" ? "Vede solo i suoi" : "Vede tutti gli interventi"}
                          </Tag>
                        )}
                        {aperti > 0 && <Tag className="bg-amber-50 text-amber-800 border-amber-400">{aperti} interventi aperti</Tag>}
                        {tempoTot > 0 && <Tag className="bg-teal-50 text-teal-700 border-teal-300"><Clock3 size={9} /> {fmtDurata(tempoTot)} registrate</Tag>}
                      </div>
                      <div className="text-xs text-stone-400 mt-2 space-y-0.5">
                        {m.telefono && <div className="flex items-center gap-1.5"><Phone size={11} /> {m.telefono}</div>}
                        {m.email && <div className="flex items-center gap-1.5"><Mail size={11} /> {m.email}</div>}
                        <div className="flex items-center gap-1.5"><MapPin size={11} /> {strutturaLabel(m.strutture)}</div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface ManutentoreFormState {
  id: string | null;
  nome: string;
  tipo: string;
  dittaId: string | null;
  visibilita: string;
  figuraProfessionaleId: string;
  telefono: string;
  email: string;
  strutture: string[];
  attivo: boolean;
  note: string;
  sostitutoId: string | null;
  eliminato?: boolean;
}
function ManutentoreForm({ esistente, prefill, strutture, ditte, manutentori, figureProfessionali, onSalva, onElimina, onClose }: {
  esistente: Manutentore | null;
  prefill?: Partial<Manutentore>;
  strutture: Struttura[];
  ditte: Ditta[];
  manutentori: Manutentore[];
  figureProfessionali: FiguraProfessionale[];
  onSalva: (dati: ManutentoreFormState) => void;
  onElimina: (id: string) => void;
  onClose: () => void;
}) {
  const vuoto: ManutentoreFormState = {
    id: null, nome: "", tipo: "Interno", dittaId: null, visibilita: "tutti", figuraProfessionaleId: "", telefono: "", email: "",
    strutture: [], attivo: true, note: "", sostitutoId: null,
  };
  const [f, setF] = useState<ManutentoreFormState>(esistente ? { ...vuoto, ...esistente } : { ...vuoto, ...(prefill || {}) });

  function upd(patch: Partial<ManutentoreFormState>) { setF((prev) => ({ ...prev, ...patch })); }

  function toggleStruttura(id: string) {
    setF((prev) => ({
      ...prev,
      strutture: prev.strutture.includes(id) ? prev.strutture.filter((x) => x !== id) : [...prev.strutture, id],
    }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!f.nome.trim()) return;
    if (f.tipo === "Esterno" && !f.dittaId) return;
    onSalva({
      ...f,
      dittaId: f.tipo === "Esterno" ? (f.dittaId || null) : null,
      visibilita: f.tipo === "Esterno" ? f.visibilita : "tutti",
      sostitutoId: f.tipo === "Interno" ? (f.sostitutoId || null) : null,
    });
  }

  return (
    <Modal title={esistente ? "Modifica manutentore" : "Nuovo manutentore"} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="flex gap-2 mb-4">
          {["Interno", "Esterno"].map((t) => (
            <button
              type="button" key={t}
              onClick={() => upd({ tipo: t })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition ${
                f.tipo === t ? "bg-[#1B2430] text-white border-[#1B2430]" : "bg-white text-stone-500 border-stone-300"
              }`}
            >
              {t === "Interno" ? <UserCog size={14} /> : <Users size={14} />}
              {t === "Interno" ? "Personale interno" : "Tecnico esterno"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome e cognome">
            <input required className={inputCls} value={f.nome} onChange={(e) => upd({ nome: e.target.value })} placeholder="Es. Marco Bortolotti" />
          </Field>
          <Field label="Figura professionale">
            <select required className={inputCls} value={f.figuraProfessionaleId} onChange={(e) => upd({ figuraProfessionaleId: e.target.value })}>
              <option value="" disabled>— seleziona una figura —</option>
              {figureProfessionali.filter((fig) => !fig.eliminato || fig.id === f.figuraProfessionaleId).map((fig) => <option key={fig.id} value={fig.id}>{fig.nome}{fig.eliminato ? " (eliminata)" : ""}</option>)}
            </select>
            <span className="text-xs text-stone-400 mt-1.5 block">Le figure si gestiscono in Impostazioni · Figure professionali.</span>
          </Field>
        </div>

        {f.tipo === "Esterno" && (
          <Field label="Ditta di appartenenza">
            <select required className={inputCls} value={f.dittaId || ""} onChange={(e) => upd({ dittaId: e.target.value || null })}>
              <option value="" disabled>— seleziona una ditta —</option>
              {ditte
                .filter((d) => !d.eliminato || d.id === f.dittaId)
                .map((d) => <option key={d.id} value={d.id}>{d.ragioneSociale}{d.eliminato ? " (eliminata)" : contrattoScaduto(d) ? " (contratto scaduto)" : ""}</option>)}
            </select>
            {!f.dittaId ? (
              <span className="text-xs text-rose-600 mt-1.5 block">Obbligatoria: un tecnico esterno deve essere collegato a una ditta per poter essere attivo e utilizzabile.</span>
            ) : ditte.find((d) => d.id === f.dittaId)?.eliminato ? (
              <span className="text-xs text-rose-600 mt-1.5 block">Questa ditta è stata eliminata: il tecnico non sarà associabile a nuovi interventi finché non viene collegato a un'altra ditta.</span>
            ) : contrattoScaduto(ditte.find((d) => d.id === f.dittaId)) ? (
              <span className="text-xs text-rose-600 mt-1.5 block">Il contratto di questa ditta è scaduto: il tecnico non sarà associabile a nuovi interventi finché il contratto non viene rinnovato.</span>
            ) : (
              <span className="text-xs text-stone-400 mt-1.5 block">Le ditte si gestiscono nella sezione "Ditte esterne" dell'Anagrafica.</span>
            )}
          </Field>
        )}

        {f.tipo === "Interno" && (
          <Field label="Sostituto per approvazioni">
            <select className={inputCls} value={f.sostitutoId || ""} onChange={(e) => upd({ sostitutoId: e.target.value || null })}>
              <option value="">— nessun sostituto —</option>
              {manutentori.filter((m) => m.tipo === "Interno" && m.id !== f.id && (!m.eliminato || m.id === f.sostitutoId)).map((m) => <option key={m.id} value={m.id}>{m.nome}{m.eliminato ? " (eliminato)" : ""}</option>)}
            </select>
            <span className="text-xs text-stone-400 mt-1.5 block">Se questa persona è approvatore di una ditta, il sostituto potrà vedere e gestire le approvazioni al suo posto (es. in caso di assenza).</span>
          </Field>
        )}

        {f.tipo === "Esterno" && (
          <Field label="Visibilità interventi">
            <div className="grid gap-1.5">
              <label className={`flex items-start gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer transition ${f.visibilita === "tutti" ? "border-[#C1622D] bg-[#C1622D]/5" : "border-stone-300"}`}>
                <input type="radio" name="visibilita" className="mt-0.5 accent-[#C1622D]" checked={f.visibilita === "tutti"} onChange={() => upd({ visibilita: "tutti" })} />
                <span>
                  <span className="block text-sm font-medium text-stone-800">Vede tutti gli interventi</span>
                  <span className="block text-xs text-stone-500">Ha visibilità su tutte le strutture e su tutti gli interventi, come il personale interno.</span>
                </span>
              </label>
              <label className={`flex items-start gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer transition ${f.visibilita === "assegnati" ? "border-[#C1622D] bg-[#C1622D]/5" : "border-stone-300"}`}>
                <input type="radio" name="visibilita" className="mt-0.5 accent-[#C1622D]" checked={f.visibilita === "assegnati"} onChange={() => upd({ visibilita: "assegnati" })} />
                <span>
                  <span className="block text-sm font-medium text-stone-800">Vede solo gli interventi assegnati a lui</span>
                  <span className="block text-xs text-stone-500">Accedendo, questo tecnico vedrà esclusivamente gli interventi a lui assegnati, non l'intero elenco.</span>
                </span>
              </label>
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono">
            <input className={inputCls} value={f.telefono} onChange={(e) => upd({ telefono: e.target.value })} placeholder="+39 …" />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={f.email} onChange={(e) => upd({ email: e.target.value })} placeholder="nome@esempio.it" />
          </Field>
        </div>

        <Field label="Strutture di competenza">
          <div className="flex flex-wrap gap-1.5">
            {strutture.map((s) => (
              <button
                type="button" key={s.id}
                onClick={() => toggleStruttura(s.id)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition ${
                  f.strutture.includes(s.id) ? "bg-[#C1622D] text-white border-[#C1622D]" : "bg-white text-stone-500 border-stone-300"
                }`}
              >
                {s.nome}
              </button>
            ))}
          </div>
          <span className="text-xs text-stone-400 mt-1.5 block">Nessuna selezione = disponibile su tutte le strutture del gruppo.</span>
        </Field>

        <Field label="Note">
          <textarea className={inputCls} rows={2} value={f.note} onChange={(e) => upd({ note: e.target.value })} placeholder="Contratti, orari, condizioni particolari…" />
        </Field>

        <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
          <input type="checkbox" checked={f.attivo} onChange={(e) => upd({ attivo: e.target.checked })} />
          <span className="text-sm text-stone-700">Attivo (disponibile per nuovi interventi)</span>
        </label>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {esistente ? (
            <button type="button" onClick={() => onElimina(esistente.id)} className="flex items-center gap-1.5 text-rose-600 text-sm font-semibold hover:text-rose-700">
              <Trash2 size={14} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#C1622D] hover:bg-[#a9531f] text-white shadow-sm">
              {esistente ? "Salva modifiche" : "Aggiungi manutentore"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  DITTE ESTERNE — anagrafica aziende + tecnici collegati              */
/* ------------------------------------------------------------------ */

function DitteEsterne({ ditte, manutentori, figureProfessionali, strutture, onNuova, onApri, onNuovoTecnico, onApriTecnico }: {
  ditte: Ditta[];
  manutentori: Manutentore[];
  figureProfessionali: FiguraProfessionale[];
  strutture: Struttura[];
  onNuova: () => void;
  onApri: (d: Ditta) => void;
  onNuovoTecnico: (dittaId: string) => void;
  onApriTecnico: (m: Manutentore) => void;
}) {
  const [ricerca, setRicerca] = useState<string>("");
  const [dittaAperta, setDittaAperta] = useState<string | null>(null);

  const tecniciDi = (dittaId) => manutentori.filter((m) => m.dittaId === dittaId && !m.eliminato);
  const figuraOf = (id) => figureProfessionali.find((f) => f.id === id)?.nome || "";
  const strutturaLabel = (ids) => (!ids || ids.length === 0 ? "Tutte le strutture" : ids.map((id) => strutture.find((s) => s.id === id)?.nome).filter(Boolean).join(", "));

  // Include anche i tecnici la cui ditta è stata eliminata: restano visibili
  // e riassegnabili invece di sparire silenziosamente dalla schermata.
  const tecniciSenzaDitta = manutentori.filter(
    (m) => m.tipo === "Esterno" && !m.eliminato && (!m.dittaId || ditte.find((d) => d.id === m.dittaId)?.eliminato)
  );

  const elenco = ditte
    .filter((d) => !d.eliminato)
    .filter((d) => !ricerca || (d.ragioneSociale + " " + d.referente + " " + d.specializzazioni.join(" ")).toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale));

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Ditte esterne</h1>
          <p className="text-stone-500 text-sm mt-1">Anagrafica delle aziende esterne e dei rispettivi tecnici</p>
        </div>
        <button onClick={onNuova} className="flex items-center gap-2 bg-[#C1622D] hover:bg-[#a9531f] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuova ditta
        </button>
      </header>

      <div className="flex items-center gap-2 mb-5 bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <Search size={15} className="text-stone-400 shrink-0" />
        <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per ragione sociale, referente o specializzazione…" className="text-sm outline-none w-full bg-transparent" />
      </div>

      <div className="grid gap-3">
        {elenco.length === 0 && (
          <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
            Nessuna ditta corrisponde alla ricerca.
          </div>
        )}
        {elenco.map((d) => {
          const tecnici = tecniciDi(d.id);
          const aperta = dittaAperta === d.id;
          return (
            <div key={d.id} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 px-5 py-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[#C1622D]/10 text-[#C1622D]">
                  <Briefcase size={18} />
                </div>
                <button onClick={() => onApri(d)} className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-stone-900">{d.ragioneSociale}</span>
                    {!d.attivo && <Tag className="bg-stone-100 text-stone-500 border-stone-300">Non attiva</Tag>}
                    {contrattoScaduto(d) && <Tag className="bg-rose-50 text-rose-700 border-rose-300"><ShieldAlert size={9} /> Contratto scaduto</Tag>}
                    {d.dataFineContratto && !contrattoScaduto(d) && (
                      <Tag className="bg-stone-50 text-stone-500 border-stone-300">Contratto fino al {fmtData(d.dataFineContratto)}</Tag>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{d.piva && <>P.IVA {d.piva} · </>}{d.indirizzo}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {d.specializzazioni.map((s) => <Tag key={s} className="bg-stone-50 text-stone-500 border-stone-300"><Star size={9} /> {s}</Tag>)}
                  </div>
                  <div className="text-xs text-stone-400 mt-2 space-y-0.5">
                    {d.referente && <div className="flex items-center gap-1.5"><UserCog size={11} /> Referente: {d.referente}</div>}
                    {d.telefono && <div className="flex items-center gap-1.5"><Phone size={11} /> {d.telefono}</div>}
                    {d.email && <div className="flex items-center gap-1.5"><Mail size={11} /> {d.email}</div>}
                    <div className="flex items-center gap-1.5"><MapPin size={11} /> {strutturaLabel(d.strutture)}</div>
                  </div>
                </button>
                <button
                  onClick={() => setDittaAperta(aperta ? null : d.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 shrink-0 px-2.5 py-1.5 rounded-lg border border-stone-200"
                >
                  {aperta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {tecnici.length} tecnic{tecnici.length === 1 ? "o" : "i"}
                </button>
              </div>

              {aperta && (
                <div className="px-5 pb-5 border-t border-stone-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5"><Users size={13} /> Tecnici della ditta</div>
                    <button onClick={() => onNuovoTecnico(d.id)} className="flex items-center gap-1 text-xs font-semibold text-[#C1622D] hover:underline">
                      <Plus size={12} /> Aggiungi tecnico
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {tecnici.map((t) => (
                      <button key={t.id} onClick={() => onApriTecnico(t)} className="text-left bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 hover:border-[#C1622D]/50 transition">
                        <div className="text-sm font-medium text-stone-800">{t.nome}</div>
                        <div className="text-xs text-stone-500">{figuraOf(t.figuraProfessionaleId)}</div>
                        {(t.telefono || t.email) && (
                          <div className="text-xs text-stone-400 mt-1 space-y-0.5">
                            {t.telefono && <div className="flex items-center gap-1"><Phone size={10} /> {t.telefono}</div>}
                            {t.email && <div className="flex items-center gap-1"><Mail size={10} /> {t.email}</div>}
                          </div>
                        )}
                      </button>
                    ))}
                    {tecnici.length === 0 && <div className="text-xs text-stone-400 sm:col-span-2">Nessun tecnico censito per questa ditta.</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tecniciSenzaDitta.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1.5">
            <Users size={13} /> Tecnici esterni senza ditta associata
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {tecniciSenzaDitta.map((t) => (
              <button key={t.id} onClick={() => onApriTecnico(t)} className="text-left bg-white border border-dashed border-stone-300 rounded-lg px-3 py-2 hover:border-[#C1622D]/50 transition">
                <div className="text-sm font-medium text-stone-800">{t.nome}</div>
                <div className="text-xs text-stone-500">{figuraOf(t.figuraProfessionaleId)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FIGURE PROFESSIONALI — anagrafica dei ruoli usati nelle tariffe     */
/* ------------------------------------------------------------------ */

function FigureProfessionali({ figureProfessionali, ditte, onAggiungi, onElimina }: {
  figureProfessionali: FiguraProfessionale[];
  ditte: Ditta[];
  onAggiungi: (nome: string) => void;
  onElimina: (id: string) => void;
}) {
  const [nuova, setNuova] = useState<string>("");

  function submit() {
    onAggiungi(nuova);
    setNuova("");
  }

  const inUsoDa = (id) => ditte.filter((d) => (d.tariffe || []).some((t) => t.figuraProfessionaleId === id)).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Figure professionali</h1>
        <p className="text-stone-500 text-sm mt-1">Anagrafica dei ruoli tecnici usati per le tariffe orarie delle ditte esterne</p>
      </header>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[#C1622D] focus:ring-1 focus:ring-[#C1622D]"
            placeholder="Nuova figura professionale (es. Fabbro)"
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <button type="button" onClick={submit} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1B2430] hover:bg-[#111722] text-white shrink-0">
            <Plus size={15} /> Aggiungi
          </button>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm divide-y divide-stone-100">
        {figureProfessionali.filter((f) => !f.eliminato).length === 0 && (
          <div className="text-center py-10 text-stone-400 text-sm">Nessuna figura professionale censita.</div>
        )}
        {figureProfessionali.filter((f) => !f.eliminato).map((f) => {
          const usi = inUsoDa(f.id);
          return (
            <div key={f.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <BadgeCheck size={16} className="text-[#C1622D] shrink-0" />
                <span className="text-sm font-medium text-stone-800 truncate">{f.nome}</span>
                {usi > 0 && <Tag className="bg-stone-100 text-stone-500 border-stone-300">usata da {usi} {usi === 1 ? "ditta" : "ditte"}</Tag>}
              </div>
              <button
                type="button"
                onClick={() => onElimina(f.id)}
                className="p-1.5 text-stone-300 hover:text-rose-600 shrink-0"
                title="Elimina figura professionale"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DittaFormState {
  id: string | null;
  ragioneSociale: string;
  piva: string;
  indirizzo: string;
  telefono: string;
  email: string;
  referente: string;
  specializzazioni: string[];
  strutture: string[];
  attivo: boolean;
  dataFineContratto: string;
  approvatoreId: string;
  tariffe: TariffaJson[];
  note: string;
}
function DittaForm({ esistente, strutture, manutentori, figureProfessionali, onSalva, onElimina, onClose }: {
  esistente: Ditta | null;
  strutture: Struttura[];
  manutentori: Manutentore[];
  figureProfessionali: FiguraProfessionale[];
  onSalva: (dati: DittaFormState) => void;
  onElimina: (id: string) => void;
  onClose: () => void;
}) {
  const vuoto: DittaFormState = {
    id: null, ragioneSociale: "", piva: "", indirizzo: "", telefono: "", email: "",
    referente: "", specializzazioni: [], strutture: [], attivo: true, dataFineContratto: "", approvatoreId: "", tariffe: [], note: "",
  };
  const [f, setF] = useState<DittaFormState>(esistente ? { ...vuoto, ...esistente, tariffe: esistente.tariffe || [] } : vuoto);
  const approvatoriDisponibili = manutentori.filter((m) => m.tipo === "Interno" && (!m.eliminato || m.id === f.approvatoreId));
  const [nuovaSpec, setNuovaSpec] = useState<string>("");
  const [nuovaTariffaFiguraId, setNuovaTariffaFiguraId] = useState<string>("");
  const [nuovaTariffaImporto, setNuovaTariffaImporto] = useState<string>("");
  const [nuovaTariffaScadenza, setNuovaTariffaScadenza] = useState<string>("");

  function upd(patch: Partial<DittaFormState>) { setF((prev) => ({ ...prev, ...patch })); }

  function toggleStruttura(id: string) {
    setF((prev) => ({
      ...prev,
      strutture: prev.strutture.includes(id) ? prev.strutture.filter((x) => x !== id) : [...prev.strutture, id],
    }));
  }

  function aggiungiSpec() {
    const v = nuovaSpec.trim();
    if (v && !f.specializzazioni.includes(v)) upd({ specializzazioni: [...f.specializzazioni, v] });
    setNuovaSpec("");
  }
  function rimuoviSpec(s) {
    upd({ specializzazioni: f.specializzazioni.filter((x) => x !== s) });
  }

  // Due tariffe valide contemporaneamente per la stessa figura sarebbero
  // ambigue: costoManodopera prenderebbe solo la prima, ignorando l'altra
  // in silenzio. Una tariffa scaduta invece non blocca: è il caso normale
  // di rinnovo (si aggiunge la nuova mantenendo la vecchia come storico).
  const tariffaGiaAttiva = !!nuovaTariffaFiguraId && f.tariffe.some((t) => t.figuraProfessionaleId === nuovaTariffaFiguraId && !tariffaScaduta(t));

  function aggiungiTariffa() {
    const figuraProfessionaleId = nuovaTariffaFiguraId;
    const importo = Number(nuovaTariffaImporto);
    if (!figuraProfessionaleId || !importo || importo <= 0) return;
    if (f.tariffe.some((t) => t.figuraProfessionaleId === figuraProfessionaleId && !tariffaScaduta(t))) return;
    upd({ tariffe: [...f.tariffe, { id: `TAR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, figuraProfessionaleId, tariffaOraria: importo, scadenza: nuovaTariffaScadenza || null }] });
    setNuovaTariffaFiguraId("");
    setNuovaTariffaImporto("");
    setNuovaTariffaScadenza("");
  }
  function rimuoviTariffa(id) {
    upd({ tariffe: f.tariffe.filter((t) => t.id !== id) });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!f.ragioneSociale.trim()) return;
    if (!f.approvatoreId) return;
    onSalva(f);
  }

  return (
    <Modal title={esistente ? "Modifica ditta esterna" : "Nuova ditta esterna"} onClose={onClose} wide>
      <form onSubmit={submit}>
        <Field label="Ragione sociale">
          <input required className={inputCls} value={f.ragioneSociale} onChange={(e) => upd({ ragioneSociale: e.target.value })} placeholder="Es. ClimaTS Srl" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Partita IVA">
            <input className={inputCls} value={f.piva} onChange={(e) => upd({ piva: e.target.value })} placeholder="IT00000000000" />
          </Field>
          <Field label="Referente">
            <input className={inputCls} value={f.referente} onChange={(e) => upd({ referente: e.target.value })} placeholder="Nome del referente commerciale" />
          </Field>
        </div>

        <Field label="Approvatore">
          <select required className={inputCls} value={f.approvatoreId} onChange={(e) => upd({ approvatoreId: e.target.value })}>
            <option value="" disabled>— seleziona un referente interno —</option>
            {approvatoriDisponibili.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.eliminato ? " (eliminato)" : ""}</option>)}
          </select>
          {!f.approvatoreId ? (
            <span className="text-xs text-rose-600 mt-1.5 block">Obbligatorio: ogni ditta esterna deve avere un referente interno che approva il lavoro svolto dai suoi tecnici.</span>
          ) : (
            <span className="text-xs text-stone-400 mt-1.5 block">Persona interna responsabile di verificare e approvare gli interventi completati dai tecnici di questa ditta.</span>
          )}
        </Field>

        <Field label="Indirizzo">
          <input className={inputCls} value={f.indirizzo} onChange={(e) => upd({ indirizzo: e.target.value })} placeholder="Via, numero civico, città" />
        </Field>

        <Field label="Data fine contratto">
          <input type="date" className={inputCls} value={f.dataFineContratto} onChange={(e) => upd({ dataFineContratto: e.target.value })} />
          <span className="text-xs text-stone-400 mt-1.5 block">
            {f.dataFineContratto
              ? (contrattoScaduto(f) ? "Contratto scaduto: i tecnici di questa ditta non sono associabili a nuovi interventi." : "Oltre questa data i tecnici della ditta non saranno più associabili a nuovi interventi.")
              : "Lascia vuoto se il contratto non ha una scadenza definita."}
          </span>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono">
            <input className={inputCls} value={f.telefono} onChange={(e) => upd({ telefono: e.target.value })} placeholder="+39 …" />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={f.email} onChange={(e) => upd({ email: e.target.value })} placeholder="info@ditta.it" />
          </Field>
        </div>

        <Field label="Specializzazioni">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {f.specializzazioni.map((s) => (
              <Tag key={s} className="bg-stone-50 text-stone-600 border-stone-300">
                {s}
                <button type="button" onClick={() => rimuoviSpec(s)} className="ml-0.5 text-stone-400 hover:text-rose-600"><X size={10} /></button>
              </Tag>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              className={inputCls}
              value={nuovaSpec}
              onChange={(e) => setNuovaSpec(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiSpec(); } }}
              placeholder="Es. Idraulico, Antincendio… (Invio per aggiungere)"
            />
            <button type="button" onClick={aggiungiSpec} className="px-3 py-2 rounded-lg bg-stone-800 text-white shrink-0"><Plus size={14} /></button>
          </div>
        </Field>

        <FieldGroup label="Tariffe orarie per figura professionale">
          <div className="border border-stone-300 rounded-lg overflow-hidden mb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2">Figura professionale</th>
                  <th className="px-3 py-2 text-right">Tariffa oraria</th>
                  <th className="px-3 py-2">Scadenza validità</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {f.tariffe.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-2.5 text-xs text-stone-400">Nessuna tariffa registrata per questa ditta.</td></tr>
                )}
                {f.tariffe.map((t) => (
                  <tr key={t.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2 text-stone-800">{figureProfessionali.find((fig) => fig.id === t.figuraProfessionaleId)?.nome || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono-tag text-stone-600">€ {t.tariffaOraria.toFixed(2)}/h</td>
                    <td className="px-3 py-2">
                      {t.scadenza ? (
                        <span className={`font-mono-tag text-xs ${tariffaScaduta(t) ? "text-rose-600 font-semibold" : "text-stone-500"}`}>
                          {fmtData(t.scadenza)}{tariffaScaduta(t) ? " · scaduta" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1 text-right">
                      <button type="button" onClick={() => rimuoviTariffa(t.id)} className="p-1 text-stone-300 hover:text-rose-600">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <select
              className={inputCls + " flex-1"}
              value={nuovaTariffaFiguraId}
              onChange={(e) => setNuovaTariffaFiguraId(e.target.value)}
            >
              <option value="" disabled>— seleziona figura professionale —</option>
              {figureProfessionali.filter((fig) => !fig.eliminato).map((fig) => <option key={fig.id} value={fig.id}>{fig.nome}</option>)}
            </select>
            <input
              type="number" min="0" step="0.5" className={inputCls + " w-24"}
              value={nuovaTariffaImporto}
              onChange={(e) => setNuovaTariffaImporto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiTariffa(); } }}
              placeholder="€/h"
            />
            <input
              type="date" className={inputCls + " w-40"}
              value={nuovaTariffaScadenza}
              onChange={(e) => setNuovaTariffaScadenza(e.target.value)}
              title="Scadenza validità (opzionale)"
            />
            <button type="button" onClick={aggiungiTariffa} disabled={tariffaGiaAttiva} className="px-3 py-2 rounded-lg bg-stone-800 text-white shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"><Plus size={14} /></button>
          </div>
          {tariffaGiaAttiva && (
            <span className="text-xs text-rose-600 mt-1.5 block">Esiste già una tariffa attiva per questa figura professionale. Elimina o lascia scadere quella esistente prima di aggiungerne una nuova.</span>
          )}
        </FieldGroup>

        <Field label="Strutture di competenza">
          <div className="flex flex-wrap gap-1.5">
            {strutture.map((s) => (
              <button
                type="button" key={s.id}
                onClick={() => toggleStruttura(s.id)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition ${
                  f.strutture.includes(s.id) ? "bg-[#C1622D] text-white border-[#C1622D]" : "bg-white text-stone-500 border-stone-300"
                }`}
              >
                {s.nome}
              </button>
            ))}
          </div>
          <span className="text-xs text-stone-400 mt-1.5 block">Nessuna selezione = disponibile su tutte le strutture del gruppo.</span>
        </Field>

        <Field label="Note">
          <textarea className={inputCls} rows={2} value={f.note} onChange={(e) => upd({ note: e.target.value })} placeholder="Contratti, condizioni, orari di reperibilità…" />
        </Field>

        <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
          <input type="checkbox" checked={f.attivo} onChange={(e) => upd({ attivo: e.target.checked })} />
          <span className="text-sm text-stone-700">Attiva (disponibile per nuovi interventi)</span>
        </label>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {esistente ? (
            <button type="button" onClick={() => onElimina(esistente.id)} className="flex items-center gap-1.5 text-rose-600 text-sm font-semibold hover:text-rose-700">
              <Trash2 size={14} /> Elimina ditta
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#C1622D] hover:bg-[#a9531f] text-white shadow-sm">
              {esistente ? "Salva modifiche" : "Aggiungi ditta"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  CENSIMENTO — verifica di quanto presente in ogni struttura          */
/* ------------------------------------------------------------------ */

function Censimento({ strutture, zoneDi, camereDi, oggettiDi, aggiungiOggetto, eliminaOggetto, segnaVerificato, creaInterventoDaOggetto, censimento }: {
  strutture: Struttura[];
  zoneDi: (strId: string) => Zona[];
  camereDi: (zonaId: string) => Camera[];
  oggettiDi: (zonaId: string, camereId: string | null) => Oggetto[];
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaOggetto: (id: string) => void;
  segnaVerificato: (id: string, condizione: string) => void;
  creaInterventoDaOggetto: (oggetto: Oggetto, titolo: string) => void;
  censimento: { totale: number; daVerificare: number; criticita: number; verificati: number; percVerificato: number };
}) {
  const [strutturaSel, setStrutturaSel] = useState<string>(strutture[0]?.id ?? "");
  const [soloDaVerificare, setSoloDaVerificare] = useState<boolean>(false);

  const zoneStruttura = zoneDi(strutturaSel);

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Censimento</h1>
        <p className="text-stone-500 text-sm mt-1">Verifica, struttura per struttura, di tutto ciò che è presente: arredi, attrezzature e impianti</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Elementi censiti" value={censimento.totale} icon={ClipboardCheck} accent="bg-[#1B2430]" />
        <StatCard label="Verificati" value={`${censimento.percVerificato}%`} icon={ShieldCheck} accent="bg-emerald-600" />
        <StatCard label="Da verificare" value={censimento.daVerificare} icon={HelpCircle} accent="bg-amber-500" />
        <StatCard label="Criticità" value={censimento.criticita} icon={ShieldAlert} accent="bg-rose-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5 bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <select value={strutturaSel} onChange={(e) => setStrutturaSel(e.target.value)} className={inputCls + " w-auto text-sm font-semibold"}>
          {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome} · {s.citta}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-stone-600 ml-auto cursor-pointer select-none">
          <input type="checkbox" checked={soloDaVerificare} onChange={(e) => setSoloDaVerificare(e.target.checked)} />
          Mostra solo criticità / da verificare
        </label>
      </div>

      <div className="grid gap-4">
        {zoneStruttura.map((z) => (
          <ZonaCensimento
            key={z.id}
            zona={z}
            camere={camereDi(z.id)}
            oggettiDi={oggettiDi}
            strutturaId={strutturaSel}
            aggiungiOggetto={aggiungiOggetto}
            eliminaOggetto={eliminaOggetto}
            segnaVerificato={segnaVerificato}
            creaInterventoDaOggetto={creaInterventoDaOggetto}
            soloDaVerificare={soloDaVerificare}
          />
        ))}
        {zoneStruttura.length === 0 && (
          <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
            Nessuna zona registrata per questa struttura. Aggiungila dall'Anagrafica.
          </div>
        )}
      </div>
    </div>
  );
}

function ZonaCensimento({ zona, camere, oggettiDi, strutturaId, aggiungiOggetto, eliminaOggetto, segnaVerificato, creaInterventoDaOggetto, soloDaVerificare }: {
  zona: Zona;
  camere: Camera[];
  oggettiDi: (zonaId: string, camereId: string | null) => Oggetto[];
  strutturaId: string;
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaOggetto: (id: string) => void;
  segnaVerificato: (id: string, condizione: string) => void;
  creaInterventoDaOggetto: (oggetto: Oggetto, titolo: string) => void;
  soloDaVerificare: boolean;
}) {
  const [aperta, setAperta] = useState<boolean>(true);
  const oggettiComuni = oggettiDi(zona.id, null);

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setAperta(!aperta)} className="w-full flex items-center gap-2.5 px-5 py-3.5 hover:bg-stone-50 transition">
        {aperta ? <ChevronDown size={15} className="text-stone-400" /> : <ChevronRight size={15} className="text-stone-400" />}
        <MapPin size={15} className="text-teal-600" />
        <span className="font-semibold text-sm text-stone-900">{zona.nome}</span>
        <Tag className="bg-stone-50 text-stone-500 border-stone-300">{zona.tipo === "piano" ? "piano" : "area comune"}</Tag>
      </button>
      {aperta && (
        <div className="px-5 pb-5 grid gap-3">
          {camere.map((c) => (
            <ListaOggettiCensimento
              key={c.id}
              titolo={`Camera ${c.numero}`}
              sottotitolo={c.tipo}
              icona={DoorClosed}
              oggetti={oggettiDi(zona.id, c.id)}
              soloDaVerificare={soloDaVerificare}
              onAggiungi={(nome, categoria, codice) => aggiungiOggetto(strutturaId, zona.id, c.id, nome, categoria, codice)}
              onElimina={eliminaOggetto}
              onVerifica={segnaVerificato}
              onCreaIntervento={creaInterventoDaOggetto}
            />
          ))}
          <ListaOggettiCensimento
            titolo="Area comune"
            sottotitolo={zona.nome}
            icona={Sofa}
            oggetti={oggettiComuni}
            soloDaVerificare={soloDaVerificare}
            onAggiungi={(nome, categoria, codice) => aggiungiOggetto(strutturaId, zona.id, null, nome, categoria, codice)}
            onElimina={eliminaOggetto}
            onVerifica={segnaVerificato}
            onCreaIntervento={creaInterventoDaOggetto}
          />
        </div>
      )}
    </div>
  );
}

function ListaOggettiCensimento({ titolo, sottotitolo, icona: Icona, oggetti, soloDaVerificare, onAggiungi, onElimina, onVerifica, onCreaIntervento }: {
  titolo: string;
  sottotitolo: string;
  icona: LucideIcon;
  oggetti: Oggetto[];
  soloDaVerificare: boolean;
  onAggiungi: (nome: string, categoria: string, codice: string) => void;
  onElimina: (id: string) => void;
  onVerifica: (id: string, condizione: string) => void;
  onCreaIntervento: (oggetto: Oggetto, titolo: string) => void;
}) {
  const [nome, setNome] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("Arredo");
  const [codice, setCodice] = useState<string>("");

  const elenco = soloDaVerificare
    ? oggetti.filter((o) => o.condizione !== "Buono")
    : oggetti;

  if (soloDaVerificare && elenco.length === 0) return null;

  return (
    <div className="border border-stone-150 rounded-lg bg-stone-50/60 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-2">
        <Icona size={13} /> {titolo} <span className="text-stone-400 font-normal">· {sottotitolo}</span>
      </div>

      <div className="grid gap-1.5 mb-2">
        {elenco.map((o) => {
          const CondIcon = condIcon[o.condizione];
          return (
            <div key={o.id} className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2.5 py-1.5 flex-wrap">
              <span className="text-xs font-medium text-stone-800 flex-1 min-w-[100px]">{o.nome}</span>
              {o.codiceCespite && <Tag className="bg-stone-50 text-stone-500 border-stone-200 font-mono-tag">{o.codiceCespite}</Tag>}
              <Tag className="bg-stone-50 text-stone-500 border-stone-200">{o.categoria}</Tag>
              <select
                value={o.condizione}
                onChange={(e) => onVerifica(o.id, e.target.value)}
                className={`text-[11px] font-semibold rounded-full px-2 py-1 border cursor-pointer ${condColor[o.condizione]}`}
              >
                {CONDIZIONI.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-[10px] text-stone-400 font-mono-tag hidden sm:inline">
                {o.ultimaVerifica ? `verificato ${fmtData(o.ultimaVerifica)}` : "mai verificato"}
              </span>
              {(o.condizione === "Guasto" || o.condizione === "Da sostituire") && (
                <button
                  onClick={() => onCreaIntervento(o, `${o.condizione}: ${o.nome}`)}
                  className="text-[11px] font-semibold text-[#C1622D] hover:underline flex items-center gap-1"
                >
                  <Wrench size={11} /> Crea intervento
                </button>
              )}
              <button onClick={() => onElimina(o.id)} className="text-stone-300 hover:text-rose-600 ml-auto">
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {elenco.length === 0 && !soloDaVerificare && <div className="text-xs text-stone-400 px-1">Nessun elemento censito qui.</div>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nuovo elemento rilevato…" className={inputCls + " text-xs py-1.5 flex-1 min-w-[110px]"} />
        <input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="Codice cespite" className={inputCls + " text-xs py-1.5 w-28 font-mono-tag"} />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls + " text-xs py-1.5 w-28"}>
          {CATEGORIE.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { if (nome.trim()) { onAggiungi(nome.trim(), categoria, codice); setNome(""); setCodice(""); } }}
          className="px-2.5 py-1.5 rounded-md bg-stone-800 text-white shrink-0"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FORM NUOVA / MODIFICA MANUTENZIONE                                  */
/* ------------------------------------------------------------------ */

interface ManutenzioneFormState {
  id: string | null;
  tipo: string;
  strutturaId: string;
  zonaId: string;
  camereId: string;
  oggettoId: string;
  titolo: string;
  descrizione: string;
  priorita: string;
  stato: string;
  scadenza: string;
  assegnatoId: string | null;
  assegnatoLibero: string | null;
  note: string;
  notaChiusura: string;
  foto: string[];
  tempoRegistrato: TempoRegistrato[];
  materiali: Materiale[];
  storico: StoricoModifica[];
  dataApprovazione: string | null;
  ricorrenza: RicorrenzaJson;
}
function ManutenzioneForm({ esistente, prefill, strutture, zoneDi, camereDi, oggettiDi, manutentori, ditte, utenteCorrente, tempiRegistrati, materialiElenco, storicoElenco, onSalva, onElimina, onClose }: {
  esistente: Manutenzione | null;
  prefill?: Partial<Manutenzione> & { strutturaId?: string; zonaId?: string; camereId?: string; oggettoId?: string; titolo?: string; priorita?: string };
  strutture: Struttura[];
  zoneDi: (strId: string) => Zona[];
  camereDi: (zonaId: string) => Camera[];
  oggettiDi: (zonaId: string, camereId: string | null) => Oggetto[];
  manutentori: Manutentore[];
  ditte: Ditta[];
  utenteCorrente: Manutentore | null;
  tempiRegistrati: TempoRegistrato[];
  materialiElenco: Materiale[];
  storicoElenco: StoricoModifica[];
  onSalva: (dati: Omit<ManutenzioneFormState, "tempoRegistrato" | "materiali" | "storico">, tempi: TempoRegistrato[], materiali: Materiale[], storico: StoricoModifica[]) => void;
  onElimina: (id: string) => void;
  onClose: () => void;
}) {
  const vuoto: ManutenzioneFormState = {
    id: null, tipo: "singola",
    strutturaId: strutture[0]?.id ?? "", zonaId: "", camereId: "", oggettoId: "",
    titolo: "", descrizione: "", priorita: "Media", stato: "Da fare",
    scadenza: oggi.toISOString().slice(0, 10), assegnatoId: null, assegnatoLibero: null, note: "", notaChiusura: "", foto: [], tempoRegistrato: [], materiali: [], storico: [], dataApprovazione: null,
    ricorrenza: { intervallo: 3, unita: "mesi" },
  };
  const iniziale = esistente
    ? {
        ...esistente, foto: esistente.foto || [],
        tempoRegistrato: tempiRegistrati.filter((t) => t.manutenzioneId === esistente.id),
        materiali: materialiElenco.filter((mt) => mt.manutenzioneId === esistente.id),
        storico: storicoElenco.filter((v) => v.manutenzioneId === esistente.id).sort((a, b) => b.data.localeCompare(a.data)),
        notaChiusura: esistente.notaChiusura || "", dataApprovazione: esistente.dataApprovazione || null, ricorrenza: esistente.ricorrenza || { intervallo: 3, unita: "mesi" },
      }
    : { ...vuoto, ...(prefill || {}), zonaId: (prefill && prefill.zonaId) || zoneDi(strutture[0]?.id ?? "")[0]?.id || "" };
  const [f, setF] = useState<ManutenzioneFormState>(iniziale);
  const [caricamento, setCaricamento] = useState<boolean>(false);
  const [nuovoTempoMinuti, setNuovoTempoMinuti] = useState<string>("");
  const [nuovoTempoNota, setNuovoTempoNota] = useState<string>("");
  const [modificaTempoId, setModificaTempoId] = useState<string | null>(null);
  const [editTempoMinuti, setEditTempoMinuti] = useState<string>("");
  const [editTempoNota, setEditTempoNota] = useState<string>("");
  const [nuovoMateriale, setNuovoMateriale] = useState<{ nome: string; quantita: string; costoUnitario: string; note: string }>({ nome: "", quantita: "1", costoUnitario: "", note: "" });

  const zoneDisp = zoneDi(f.strutturaId);
  const camereDisp = camereDi(f.zonaId);
  const oggettiDisp = oggettiDi(f.zonaId, f.camereId || null);
  const bloccato = !!esistente && !["Da fare", "Presa in carico", "In corso"].includes(f.stato);

  function upd(patch: Partial<ManutenzioneFormState>) { setF((prev) => ({ ...prev, ...patch })); }

  function aggiungiFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setCaricamento(true);
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    ).then((dataUrls) => {
      setF((prev) => ({ ...prev, foto: [...prev.foto, ...dataUrls] }));
      setCaricamento(false);
    }).catch(() => setCaricamento(false));
    e.target.value = "";
  }

  function rimuoviFoto(idx) {
    setF((prev) => ({ ...prev, foto: prev.foto.filter((_, i) => i !== idx) }));
  }

  function prendiInCarico() {
    upd(utenteCorrente ? { stato: "Presa in carico", assegnatoId: utenteCorrente.id, assegnatoLibero: null } : { stato: "Presa in carico" });
  }

  function completaIntervento() {
    if (!f.notaChiusura.trim()) return;
    upd({ stato: "In accettazione" });
  }

  function riapriIntervento() {
    upd({ stato: "In corso" });
  }

  function aggiungiVoceTempo() {
    const minuti = Number(nuovoTempoMinuti);
    const nota = nuovoTempoNota.trim();
    if (!utenteCorrente || !minuti || minuti <= 0 || !nota) return;
    upd({
      tempoRegistrato: [
        ...f.tempoRegistrato,
        { id: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, manutentoreId: utenteCorrente.id, minuti, data: oggi.toISOString().slice(0, 10), note: nota },
      ],
    });
    setNuovoTempoMinuti("");
    setNuovoTempoNota("");
  }
  function rimuoviVoceTempo(id) {
    upd({ tempoRegistrato: f.tempoRegistrato.filter((t) => t.id !== id) });
    if (modificaTempoId === id) setModificaTempoId(null);
  }
  function iniziaModificaTempo(t) {
    setModificaTempoId(t.id);
    setEditTempoMinuti(String(t.minuti));
    setEditTempoNota(t.note || "");
  }
  function annullaModificaTempo() {
    setModificaTempoId(null);
    setEditTempoMinuti("");
    setEditTempoNota("");
  }
  function salvaModificaTempo() {
    const minuti = Number(editTempoMinuti);
    const nota = editTempoNota.trim();
    if (!minuti || minuti <= 0 || !nota) return;
    upd({
      tempoRegistrato: f.tempoRegistrato.map((t) => (t.id === modificaTempoId ? { ...t, minuti, note: nota } : t)),
    });
    annullaModificaTempo();
  }

  function aggiungiMateriale() {
    const nome = nuovoMateriale.nome.trim();
    const quantita = Number(nuovoMateriale.quantita) || 1;
    const costoUnitario = Number(nuovoMateriale.costoUnitario) || 0;
    if (!nome) return;
    upd({
      materiali: [
        ...f.materiali,
        { id: `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nome, quantita, costoUnitario, note: nuovoMateriale.note.trim(), stato: "Da ordinare" },
      ],
    });
    setNuovoMateriale({ nome: "", quantita: "1", costoUnitario: "", note: "" });
  }
  function rimuoviMateriale(id) {
    upd({ materiali: f.materiali.filter((mt) => mt.id !== id) });
  }
  function cambiaStatoMateriale(id, stato) {
    upd({ materiali: f.materiali.map((mt) => (mt.id === id ? { ...mt, stato } : mt)) });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!f.titolo.trim()) return;
    const { tempoRegistrato, materiali, storico, ...core } = f;
    const dati = {
      ...core,
      camereId: f.camereId || null,
      oggettoId: f.oggettoId || null,
      ricorrenza: f.tipo === "programmata" ? f.ricorrenza : null,
      dataApprovazione: f.stato === "Completata" ? (f.dataApprovazione || oggi.toISOString().slice(0, 10)) : null,
    };
    const utenteId = utenteCorrente ? utenteCorrente.id : null;
    const dettagli = esistente
      ? creaDettagliModifica({ ...esistente, tempoRegistrato: iniziale.tempoRegistrato }, { ...dati, tempoRegistrato }, manutentori)
      : ["Intervento creato"];
    let storicoFinale = storico;
    if (dettagli.length > 0) {
      const voceStorico = { id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, data: new Date().toISOString(), utenteId, dettagli };
      storicoFinale = [voceStorico, ...storico];
    }
    onSalva(dati, tempoRegistrato, materiali, storicoFinale);
  }

  return (
    <Modal title={esistente ? "Modifica intervento" : "Nuovo intervento di manutenzione"} onClose={onClose} wide>
      <form onSubmit={submit}>
        {bloccato && (
          <div className="flex items-center gap-2 mb-4 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium rounded-lg px-3.5 py-2.5">
            <ShieldAlert size={14} className="shrink-0" />
            Intervento {f.stato === "Annullata" ? "annullato" : "completato"}: i campi sono bloccati. Usa "Riapri intervento" per modificarli.
          </div>
        )}

        <fieldset disabled={bloccato} className="contents">
        <div className="flex gap-2 mb-4">
          {["singola", "programmata"].map((t) => (
            <button
              type="button" key={t}
              onClick={() => upd({ tipo: t })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition ${
                f.tipo === t ? "bg-[#1B2430] text-white border-[#1B2430]" : "bg-white text-stone-500 border-stone-300"
              }`}
            >
              {t === "singola" ? <Wrench size={14} /> : <Repeat size={14} />}
              {t === "singola" ? "Riparazione singola" : "Manutenzione programmata"}
            </button>
          ))}
        </div>

        <Field label="Titolo">
          <input required className={inputCls} value={f.titolo} onChange={(e) => upd({ titolo: e.target.value })} placeholder="Es. Perdita rubinetto bagno" />
        </Field>

        <Field label="Descrizione">
          <textarea className={inputCls} rows={2} value={f.descrizione} onChange={(e) => upd({ descrizione: e.target.value })} placeholder="Dettagli del problema o dell'intervento richiesto" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Struttura">
            <select className={inputCls} value={f.strutturaId} onChange={(e) => { const sid = e.target.value; upd({ strutturaId: sid, zonaId: zoneDi(sid)[0]?.id ?? "", camereId: "", oggettoId: "" }); }}>
              {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          <Field label="Zona">
            <select className={inputCls} value={f.zonaId} onChange={(e) => upd({ zonaId: e.target.value, camereId: "", oggettoId: "" })}>
              {zoneDisp.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Camera (opzionale)">
            <select className={inputCls} value={f.camereId} onChange={(e) => upd({ camereId: e.target.value, oggettoId: "" })}>
              <option value="">— area comune —</option>
              {camereDisp.map((c) => <option key={c.id} value={c.id}>Camera {c.numero}</option>)}
            </select>
          </Field>
          <Field label="Oggetto / arredo / attrezzatura">
            <select className={inputCls} value={f.oggettoId} onChange={(e) => upd({ oggettoId: e.target.value })}>
              <option value="">— generico / non specificato —</option>
              {oggettiDisp.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.codiceCespite ? ` [${o.codiceCespite}]` : ""} ({o.categoria})</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Priorità">
            <select className={inputCls} value={f.priorita} onChange={(e) => upd({ priorita: e.target.value })}>
              {PRIORITA.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Stato">
            <select className={inputCls} value={f.stato} onChange={(e) => upd({ stato: e.target.value })}>
              {(utenteCorrente ? STATI.filter((s) => s !== "Completata") : STATI).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {utenteCorrente && <span className="block text-xs text-stone-400 mt-1">Solo un amministratore può segnare un intervento come completato.</span>}
          </Field>
        </div>
        </fieldset>

        {esistente && (
          ["Da fare", "Presa in carico", "In corso"].includes(f.stato) ? (
            <div className="mb-4">
              <div className="flex gap-2">
                {f.stato === "Da fare" && (
                  <button
                    type="button"
                    onClick={prendiInCarico}
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
                  >
                    <UserCheck size={16} />
                    {utenteCorrente ? `Prendi in carico come ${utenteCorrente.nome}` : "Prendi in carico"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={completaIntervento}
                  disabled={!f.notaChiusura.trim()}
                  className={`flex-1 flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition ${
                    f.notaChiusura.trim() ? "bg-amber-500 hover:bg-amber-600" : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 size={16} />
                  Completato
                </button>
              </div>
              {!f.notaChiusura.trim() && (
                <span className="block text-xs text-stone-400 mt-1.5">Compila la nota di chiusura più in basso per poter segnare l'intervento come completato.</span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={riapriIntervento}
              className="w-full flex items-center justify-center gap-2 mb-4 bg-stone-600 hover:bg-stone-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
            >
              <RotateCcw size={16} />
              Riapri intervento
            </button>
          )
        )}

        <fieldset disabled={bloccato} className="contents">
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.tipo === "programmata" ? "Prossima scadenza" : "Scadenza / entro il"}>
            <input type="date" className={inputCls} value={f.scadenza} onChange={(e) => upd({ scadenza: e.target.value })} />
          </Field>
          <Field label="Assegnato a">
            <select
              className={inputCls}
              value={f.assegnatoId ? f.assegnatoId : (f.assegnatoLibero !== null ? "__altro__" : "")}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__altro__") upd({ assegnatoId: null, assegnatoLibero: "" });
                else if (v === "") upd({ assegnatoId: null, assegnatoLibero: null });
                else upd({ assegnatoId: v, assegnatoLibero: null });
              }}
            >
              <option value="">— non assegnato —</option>
              <optgroup label="Interni">
                {manutentori
                  .filter((m) => m.tipo === "Interno" && (manutentoreDisponibile(m, ditte) || m.id === f.assegnatoId))
                  .map((m) => <option key={m.id} value={m.id}>{m.nome}{!manutentoreDisponibile(m, ditte) ? " (non disponibile)" : ""}</option>)}
              </optgroup>
              <optgroup label="Esterni">
                {manutentori
                  .filter((m) => m.tipo === "Esterno" && (manutentoreDisponibile(m, ditte) || m.id === f.assegnatoId))
                  .map((m) => <option key={m.id} value={m.id}>{m.nome}{!manutentoreDisponibile(m, ditte) ? " (non disponibile)" : ""}</option>)}
              </optgroup>
              <option value="__altro__">Altro (inserisci manualmente)…</option>
            </select>
            {manutentori.some((m) => m.id === f.assegnatoId && !manutentoreDisponibile(m, ditte)) && (
              <span className="text-xs text-amber-700 mt-1.5 block">
                Questo manutentore non è più disponibile (rimosso, non attivo, ditta non collegata/non attiva o con contratto scaduto). Resta assegnato a questo intervento ma non sarà proponibile per nuovi interventi.
              </span>
            )}
            {f.assegnatoLibero !== null && (
              <input
                className={inputCls + " mt-1.5"}
                value={f.assegnatoLibero}
                onChange={(e) => upd({ assegnatoLibero: e.target.value })}
                placeholder="Nome tecnico o ditta esterna"
                autoFocus
              />
            )}
          </Field>
        </div>

        {f.tipo === "programmata" && (
          <Field label="Ricorrenza">
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-500">Ogni</span>
              <input type="number" min={1} className={inputCls + " w-20"} value={f.ricorrenza.intervallo} onChange={(e) => upd({ ricorrenza: { ...f.ricorrenza, intervallo: Number(e.target.value) } })} />
              <select className={inputCls} value={f.ricorrenza.unita} onChange={(e) => upd({ ricorrenza: { ...f.ricorrenza, unita: e.target.value } })}>
                {UNITA_RICORRENZA.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </Field>
        )}

        <Field label="Foto">
          <div className="flex flex-wrap gap-2 mb-2">
            {f.foto.map((src, i) => (
              <div key={i} className="relative group">
                <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-stone-300" />
                <button
                  type="button"
                  onClick={() => rimuoviFoto(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 hover:border-[#C1622D] hover:text-[#C1622D] cursor-pointer transition">
              <ImagePlus size={18} />
              <input type="file" accept="image/*" multiple className="hidden" onChange={aggiungiFoto} />
            </label>
          </div>
          {caricamento && <span className="text-xs text-stone-400">Caricamento foto…</span>}
          <span className="text-xs text-stone-400">Puoi allegare una o più foto dello stato dell'oggetto o dell'intervento eseguito.</span>
        </Field>

        <FieldGroup label={`Tempo registrato${f.tempoRegistrato.length ? ` · totale ${fmtDurata(f.tempoRegistrato.reduce((s, t) => s + t.minuti, 0))}` : ""}`}>
          <div className="border border-stone-300 rounded-lg divide-y divide-stone-200 mb-2 overflow-hidden">
            {f.tempoRegistrato.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-stone-400">Nessun tempo registrato per questo intervento.</div>
            )}
            {f.tempoRegistrato.map((t) => (
              <div key={t.id} className="px-3 py-2 text-sm">
                {modificaTempoId === t.id ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-stone-600 text-xs shrink-0">{nomeManutentoreId(t.manutentoreId, manutentori) || "—"}</span>
                    <input
                      type="number" min="1" className={inputCls + " w-20 text-xs py-1.5"}
                      value={editTempoMinuti} onChange={(e) => setEditTempoMinuti(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvaModificaTempo(); } }}
                    />
                    <input
                      className={inputCls + " flex-1 min-w-[120px] text-xs py-1.5"} placeholder="Nota (obbligatoria)"
                      value={editTempoNota} onChange={(e) => setEditTempoNota(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvaModificaTempo(); } }}
                    />
                    <button type="button" onClick={salvaModificaTempo} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#1B2430] text-white shrink-0">
                      Salva
                    </button>
                    <button type="button" onClick={annullaModificaTempo} className="px-2.5 py-1 rounded-md text-xs font-semibold text-stone-500 hover:bg-stone-100 shrink-0">
                      Annulla
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800 flex-1 truncate">{nomeManutentoreId(t.manutentoreId, manutentori) || "—"}</span>
                      <span className="text-stone-600 font-mono-tag">{fmtDurata(t.minuti)}</span>
                      <span className="text-xs text-stone-400 font-mono-tag">{fmtData(t.data)}</span>
                      <button
                        type="button"
                        onClick={() => iniziaModificaTempo(t)}
                        className="p-1 -m-1 text-stone-300 hover:text-stone-600 shrink-0"
                        title="Modifica voce"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rimuoviVoceTempo(t.id)}
                        className="p-1 -m-1 text-stone-300 hover:text-rose-600 shrink-0"
                        title="Rimuovi voce"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {t.note && <div className="text-xs text-stone-500 mt-0.5">{t.note}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
          {utenteCorrente ? (
            <>
              <div className="flex gap-2 mb-2">
                <span className="flex items-center px-3 py-2 rounded-lg bg-stone-100 text-sm text-stone-600 flex-1 truncate">
                  <UserCog size={13} className="mr-1.5 shrink-0" /> {utenteCorrente.nome}
                </span>
                <input
                  type="number" min="1" className={inputCls + " w-24"} placeholder="min"
                  value={nuovoTempoMinuti} onChange={(e) => setNuovoTempoMinuti(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiVoceTempo(); } }}
                />
              </div>
              <div className="flex gap-2">
                <input
                  className={inputCls} placeholder="Nota sul lavoro svolto (obbligatoria)"
                  value={nuovoTempoNota} onChange={(e) => setNuovoTempoNota(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiVoceTempo(); } }}
                />
                <button type="button" onClick={aggiungiVoceTempo} className="px-3 py-2 rounded-lg text-sm font-semibold bg-[#1B2430] hover:bg-[#111722] text-white shrink-0">
                  Aggiungi
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-stone-400 flex items-center gap-1.5">
              <UserCog size={13} /> Seleziona "Accesso come" nella barra laterale per registrare il tuo tempo su questo intervento.
            </div>
          )}
        </FieldGroup>

        <FieldGroup label={`Materiale necessario${f.materiali.length ? ` · totale € ${f.materiali.reduce((s, mt) => s + mt.quantita * mt.costoUnitario, 0).toFixed(2)}` : ""}`}>
          {f.materiali.length > 0 && (
            <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 mb-3">
              {f.materiali.map((mt) => (
                <div key={mt.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-800 flex-1 min-w-[100px] truncate">{mt.nome}</span>
                    <span className="text-xs text-stone-500 font-mono-tag">{mt.quantita} × € {mt.costoUnitario.toFixed(2)}</span>
                    <span className="text-xs text-stone-700 font-semibold font-mono-tag">€ {(mt.quantita * mt.costoUnitario).toFixed(2)}</span>
                    <select
                      value={mt.stato} onChange={(e) => cambiaStatoMateriale(mt.id, e.target.value)}
                      className={`text-[11px] font-semibold rounded-md px-1.5 py-1 border outline-none ${statoMaterialeColor[mt.stato]}`}
                    >
                      {STATI_MATERIALE.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => rimuoviMateriale(mt.id)}
                      className="p-1 -m-1 text-stone-300 hover:text-rose-600 shrink-0"
                      title="Rimuovi materiale"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {mt.note && <div className="text-xs text-stone-500 mt-0.5">{mt.note}</div>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mb-2 flex-wrap">
            <input
              className={inputCls + " flex-1 min-w-[140px]"} placeholder="Materiale (es. compressore, guarnizione...)"
              value={nuovoMateriale.nome} onChange={(e) => setNuovoMateriale((p) => ({ ...p, nome: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiMateriale(); } }}
            />
            <input
              type="number" min="1" className={inputCls + " w-20"} placeholder="Qtà"
              value={nuovoMateriale.quantita} onChange={(e) => setNuovoMateriale((p) => ({ ...p, quantita: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiMateriale(); } }}
            />
            <input
              type="number" min="0" step="0.01" className={inputCls + " w-28"} placeholder="Costo unitario €"
              value={nuovoMateriale.costoUnitario} onChange={(e) => setNuovoMateriale((p) => ({ ...p, costoUnitario: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiMateriale(); } }}
            />
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls} placeholder="Nota (fornitore, riferimento ordine, ecc.)"
              value={nuovoMateriale.note} onChange={(e) => setNuovoMateriale((p) => ({ ...p, note: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiMateriale(); } }}
            />
            <button type="button" onClick={aggiungiMateriale} className="px-3 py-2 rounded-lg text-sm font-semibold bg-[#1B2430] hover:bg-[#111722] text-white shrink-0">
              Aggiungi
            </button>
          </div>
        </FieldGroup>

        <Field label="Note">
          <textarea className={inputCls} rows={2} value={f.note} onChange={(e) => upd({ note: e.target.value })} placeholder="Note interne, ricambi utilizzati, ecc." />
        </Field>

        <Field label="Nota di chiusura">
          <textarea
            className={inputCls} rows={2} value={f.notaChiusura} onChange={(e) => upd({ notaChiusura: e.target.value })}
            placeholder="Sintesi del lavoro svolto ed esito finale, da compilare quando l'intervento viene completato."
          />
        </Field>
        </fieldset>

        {f.storico.length > 0 && (
          <FieldGroup label="Storico modifiche">
            <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-48 overflow-y-auto">
              {f.storico.map((v) => (
                <div key={v.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-stone-700">{nomeManutentoreId(v.utenteId, manutentori) || "Amministratore"}</span>
                    <span className="text-stone-400 font-mono-tag shrink-0">{fmtDataOra(v.data)}</span>
                  </div>
                  <ul className="mt-1 list-disc list-inside text-stone-500 space-y-0.5">
                    {v.dettagli.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </FieldGroup>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {esistente ? (
            <button type="button" onClick={() => onElimina(esistente.id)} className="flex items-center gap-1.5 text-rose-600 text-sm font-semibold hover:text-rose-700">
              <Trash2 size={14} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#C1622D] hover:bg-[#a9531f] text-white shadow-sm">
              {esistente ? "Salva modifiche" : "Crea intervento"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  ANAGRAFICA STRUTTURE / ZONE / CAMERE / OGGETTI                      */
/* ------------------------------------------------------------------ */

function Anagrafica({ strutture, zoneDi, camereDi, oggettiDi, aggiungiStruttura, eliminaStruttura, aggiungiZona, aggiungiCamera, aggiungiOggetto, eliminaZona, eliminaCamera, eliminaOggetto }: {
  strutture: Struttura[];
  zoneDi: (strId: string) => Zona[];
  camereDi: (zonaId: string) => Camera[];
  oggettiDi: (zonaId: string, camereId: string | null) => Oggetto[];
  aggiungiStruttura: (nome: string, citta: string, tipo: string) => void;
  eliminaStruttura: (id: string) => void;
  aggiungiZona: (strutturaId: string, nome: string, tipo: string) => void;
  aggiungiCamera: (zonaId: string, numero: string, tipo: string) => void;
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaZona: (id: string) => void;
  eliminaCamera: (id: string) => void;
  eliminaOggetto: (id: string) => void;
}) {
  const [apertaStruttura, setApertaStruttura] = useState<string | null>(strutture[0]?.id ?? null);
  const [nuovaStruttura, setNuovaStruttura] = useState<string>("");
  const [nuovaCitta, setNuovaCitta] = useState<string>("");
  const [nuovoTipo, setNuovoTipo] = useState<string>("Ostello");

  function submitStruttura() {
    if (!nuovaStruttura.trim()) return;
    aggiungiStruttura(nuovaStruttura.trim(), nuovaCitta.trim(), nuovoTipo);
    setNuovaStruttura("");
    setNuovaCitta("");
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Anagrafica strutture</h1>
        <p className="text-stone-500 text-sm mt-1">Strutture, zone, camere e oggetti soggetti a manutenzione — Gruppo Urban Homy</p>
      </header>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex gap-2 flex-wrap">
          <input value={nuovaStruttura} onChange={(e) => setNuovaStruttura(e.target.value)} placeholder="Nome nuova struttura" className={inputCls + " flex-1 min-w-[160px]"} />
          <input value={nuovaCitta} onChange={(e) => setNuovaCitta(e.target.value)} placeholder="Città" className={inputCls + " w-40"} />
          <select value={nuovoTipo} onChange={(e) => setNuovoTipo(e.target.value)} className={inputCls + " w-32"}>
            <option value="Ostello">Ostello</option>
            <option value="B&B">B&B</option>
            <option value="Albergo">Albergo</option>
          </select>
          <button type="button" onClick={submitStruttura} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1B2430] hover:bg-[#111722] text-white shrink-0">
            <Plus size={15} /> Aggiungi struttura
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {strutture.length === 0 && (
          <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
            Nessuna struttura censita.
          </div>
        )}
        {strutture.map((s) => (
          <div key={s.id} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-1 pr-2">
              <button
                onClick={() => setApertaStruttura(apertaStruttura === s.id ? null : s.id)}
                className="flex-1 min-w-0 flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition"
              >
                {apertaStruttura === s.id ? <ChevronDown size={16} className="text-stone-400 shrink-0" /> : <ChevronRight size={16} className="text-stone-400 shrink-0" />}
                <Building2 size={18} className="text-[#C1622D] shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-[Fraunces] font-semibold text-stone-900">{s.nome}</div>
                  <div className="text-xs text-stone-500">{s.citta} · {s.tipo} · {zoneDi(s.id).length} zone</div>
                </div>
              </button>
              <button onClick={() => eliminaStruttura(s.id)} className="p-2 text-stone-300 hover:text-rose-600 shrink-0" title="Elimina struttura">
                <Trash2 size={15} />
              </button>
            </div>
            {apertaStruttura === s.id && (
              <div className="px-5 pb-5">
                <ZoneStruttura
                  strutturaId={s.id}
                  zone={zoneDi(s.id)}
                  camereDi={camereDi}
                  oggettiDi={oggettiDi}
                  aggiungiZona={aggiungiZona}
                  aggiungiCamera={aggiungiCamera}
                  aggiungiOggetto={aggiungiOggetto}
                  eliminaZona={eliminaZona}
                  eliminaCamera={eliminaCamera}
                  eliminaOggetto={eliminaOggetto}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ZoneStruttura({ strutturaId, zone, camereDi, oggettiDi, aggiungiZona, aggiungiCamera, aggiungiOggetto, eliminaZona, eliminaCamera, eliminaOggetto }: {
  strutturaId: string;
  zone: Zona[];
  camereDi: (zonaId: string) => Camera[];
  oggettiDi: (zonaId: string, camereId: string | null) => Oggetto[];
  aggiungiZona: (strutturaId: string, nome: string, tipo: string) => void;
  aggiungiCamera: (zonaId: string, numero: string, tipo: string) => void;
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaZona: (id: string) => void;
  eliminaCamera: (id: string) => void;
  eliminaOggetto: (id: string) => void;
}) {
  const [nuovaZona, setNuovaZona] = useState<string>("");
  const [tipoZona, setTipoZona] = useState<string>("piano");
  const [zonaAperta, setZonaAperta] = useState<string | null>(null);

  return (
    <div className="border-t border-stone-100 pt-4">
      <div className="flex gap-2 mb-3">
        <input value={nuovaZona} onChange={(e) => setNuovaZona(e.target.value)} placeholder="Nome nuova zona (es. Piano 3, Cucina…)" className={inputCls + " text-sm"} />
        <select value={tipoZona} onChange={(e) => setTipoZona(e.target.value)} className={inputCls + " w-32 text-sm"}>
          <option value="piano">Piano</option>
          <option value="comune">Area comune</option>
        </select>
        <button
          onClick={() => { if (nuovaZona.trim()) { aggiungiZona(strutturaId, nuovaZona.trim(), tipoZona); setNuovaZona(""); } }}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-stone-800 text-white text-sm font-semibold shrink-0"
        >
          <Plus size={14} /> Zona
        </button>
      </div>

      <div className="grid gap-2">
        {zone.map((z) => (
          <div key={z.id} className="border border-stone-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50">
              <button onClick={() => setZonaAperta(zonaAperta === z.id ? null : z.id)} className="flex items-center gap-2 flex-1 text-left">
                {zonaAperta === z.id ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
                <MapPin size={14} className="text-teal-600" />
                <span className="text-sm font-semibold text-stone-800">{z.nome}</span>
                <Tag className="bg-white text-stone-500 border-stone-300">{z.tipo === "piano" ? "piano" : "area comune"}</Tag>
              </button>
              <button onClick={() => eliminaZona(z.id)} className="p-1.5 text-stone-400 hover:text-rose-600">
                <Trash2 size={13} />
              </button>
            </div>
            {zonaAperta === z.id && (
              <div className="p-3 grid md:grid-cols-2 gap-3">
                <CamereZona zonaId={z.id} camere={camereDi(z.id)} aggiungiCamera={aggiungiCamera} eliminaCamera={eliminaCamera} oggettiDi={oggettiDi} aggiungiOggetto={aggiungiOggetto} eliminaOggetto={eliminaOggetto} strutturaId={strutturaId} />
                <OggettiZonaComune zonaId={z.id} strutturaId={strutturaId} oggetti={oggettiDi(z.id, null)} aggiungiOggetto={aggiungiOggetto} eliminaOggetto={eliminaOggetto} />
              </div>
            )}
          </div>
        ))}
        {zone.length === 0 && <div className="text-sm text-stone-400 px-1">Nessuna zona ancora. Aggiungine una sopra.</div>}
      </div>
    </div>
  );
}

function CamereZona({ zonaId, strutturaId, camere, aggiungiCamera, eliminaCamera, oggettiDi, aggiungiOggetto, eliminaOggetto }: {
  zonaId: string;
  strutturaId: string;
  camere: Camera[];
  aggiungiCamera: (zonaId: string, numero: string, tipo: string) => void;
  eliminaCamera: (id: string) => void;
  oggettiDi: (zonaId: string, camereId: string | null) => Oggetto[];
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaOggetto: (id: string) => void;
}) {
  const [numero, setNumero] = useState<string>("");
  const [tipoCamera, setTipoCamera] = useState<string>("Doppia");
  const [cameraAperta, setCameraAperta] = useState<string | null>(null);

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1.5"><DoorClosed size={13} /> Camere</div>
      <div className="flex gap-1.5 mb-2">
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Numero" className={inputCls + " text-xs py-1.5"} />
        <select value={tipoCamera} onChange={(e) => setTipoCamera(e.target.value)} className={inputCls + " text-xs py-1.5 w-32"}>
          <option>Singola</option><option>Doppia</option><option>Tripla</option><option>Suite</option>
          <option>Dormitorio 4 letti</option><option>Dormitorio 6 letti</option><option>Appartamento</option>
        </select>
        <button onClick={() => { if (numero.trim()) { aggiungiCamera(zonaId, numero.trim(), tipoCamera); setNumero(""); } }} className="px-2.5 py-1.5 rounded-md bg-stone-800 text-white shrink-0"><Plus size={13} /></button>
      </div>
      <div className="space-y-1.5">
        {camere.map((c) => (
          <div key={c.id} className="border border-stone-200 rounded-md">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-white">
              <button onClick={() => setCameraAperta(cameraAperta === c.id ? null : c.id)} className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                {cameraAperta === c.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Camera {c.numero} <span className="text-stone-400">· {c.tipo}</span>
              </button>
              <button onClick={() => eliminaCamera(c.id)} className="text-stone-300 hover:text-rose-600"><Trash2 size={12} /></button>
            </div>
            {cameraAperta === c.id && (
              <div className="px-2.5 pb-2.5">
                <OggettiCamera strutturaId={strutturaId} zonaId={zonaId} camereId={c.id} oggetti={oggettiDi(zonaId, c.id)} aggiungiOggetto={aggiungiOggetto} eliminaOggetto={eliminaOggetto} />
              </div>
            )}
          </div>
        ))}
        {camere.length === 0 && <div className="text-xs text-stone-400">Nessuna camera in questa zona.</div>}
      </div>
    </div>
  );
}

function OggettiCamera({ strutturaId, zonaId, camereId, oggetti, aggiungiOggetto, eliminaOggetto }: {
  strutturaId: string;
  zonaId: string;
  camereId: string;
  oggetti: Oggetto[];
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaOggetto: (id: string) => void;
}) {
  const [nome, setNome] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("Arredo");
  const [codice, setCodice] = useState<string>("");
  return (
    <div className="mt-1 border-t border-stone-100 pt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5 flex items-center gap-1"><Sofa size={11} /> Oggetti / arredi / attrezzature</div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome oggetto" className={inputCls + " text-xs py-1 flex-1 min-w-[110px]"} />
        <input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="Codice cespite" className={inputCls + " text-xs py-1 w-28 font-mono-tag"} />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls + " text-xs py-1 w-28"}>
          {CATEGORIE.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => { if (nome.trim()) { aggiungiOggetto(strutturaId, zonaId, camereId, nome.trim(), categoria, codice); setNome(""); setCodice(""); } }} className="px-2 py-1 rounded-md bg-[#C1622D] text-white shrink-0"><Plus size={12} /></button>
      </div>
      <ul className="space-y-1">
        {oggetti.map((o) => (
          <li key={o.id} className="flex items-center justify-between text-xs bg-stone-50 rounded px-2 py-1 gap-2">
            <span className="text-stone-700 truncate">{o.nome} <span className="text-stone-400">· {o.categoria}</span></span>
            <span className="flex items-center gap-1.5 shrink-0">
              {o.codiceCespite && <Tag className="bg-white text-stone-500 border-stone-300 font-mono-tag">{o.codiceCespite}</Tag>}
              <button onClick={() => eliminaOggetto(o.id)} className="text-stone-300 hover:text-rose-600"><Trash2 size={11} /></button>
            </span>
          </li>
        ))}
        {oggetti.length === 0 && <li className="text-xs text-stone-400">Nessun oggetto registrato.</li>}
      </ul>
    </div>
  );
}

function OggettiZonaComune({ zonaId, strutturaId, oggetti, aggiungiOggetto, eliminaOggetto }: {
  zonaId: string;
  strutturaId: string;
  oggetti: Oggetto[];
  aggiungiOggetto: (strutturaId: string, zonaId: string, camereId: string | null, nome: string, categoria: string, codice: string) => void;
  eliminaOggetto: (id: string) => void;
}) {
  const [nome, setNome] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("Arredo");
  const [codice, setCodice] = useState<string>("");
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1.5"><Sofa size={13} /> Oggetti / attrezzature dell'area</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome oggetto" className={inputCls + " text-xs py-1.5 flex-1 min-w-[110px]"} />
        <input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="Codice cespite" className={inputCls + " text-xs py-1.5 w-28 font-mono-tag"} />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls + " text-xs py-1.5 w-28"}>
          {CATEGORIE.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => { if (nome.trim()) { aggiungiOggetto(strutturaId, zonaId, null, nome.trim(), categoria, codice); setNome(""); setCodice(""); } }} className="px-2.5 py-1.5 rounded-md bg-[#C1622D] text-white shrink-0"><Plus size={13} /></button>
      </div>
      <ul className="space-y-1.5">
        {oggetti.map((o) => (
          <li key={o.id} className="flex items-center justify-between text-xs bg-white border border-stone-200 rounded px-2.5 py-1.5 gap-2">
            <span className="text-stone-700 truncate">{o.nome} <span className="text-stone-400">· {o.categoria}</span></span>
            <span className="flex items-center gap-1.5 shrink-0">
              {o.codiceCespite && <Tag className="bg-stone-50 text-stone-500 border-stone-300 font-mono-tag">{o.codiceCespite}</Tag>}
              <button onClick={() => eliminaOggetto(o.id)} className="text-stone-300 hover:text-rose-600"><Trash2 size={12} /></button>
            </span>
          </li>
        ))}
        {oggetti.length === 0 && <li className="text-xs text-stone-400">Nessun oggetto registrato per quest'area.</li>}
      </ul>
    </div>
  );
}
