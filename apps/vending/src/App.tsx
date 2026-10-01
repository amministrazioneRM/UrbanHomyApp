import React, { useState, useMemo, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import type { UHAccount, UHSede } from "./accounts";
import {
  ShoppingCart, LayoutGrid, Wallet, Plus, Pencil, Trash2, X, ArrowLeft,
  Settings, MapPin, Package, Euro, ChevronDown, CheckCircle2,
  Search, Upload, AlertTriangle, Banknote, CreditCard, Smartphone, RotateCcw,
} from "lucide-react";
// @ts-ignore
import * as XLSX from "xlsx";
import UHAccounts from "./accounts";
import { api, useSyncedResource, useBackendOffline } from "./api";
const APP_ID = "vendingMachine";

interface VendingStruttura { id: string; sedeCentraleId: string; nome: string; citta: string; attiva: boolean }
interface VendingMacchina { id: string; strutturaId: string; nome: string; tipo: string; attiva: boolean }
interface VendingVendita { id: string; strutturaId: string; macchinaId?: string; macchinaNome?: string; data: string; ora: string; prodotto: string; quantita: number; prezzoUnitario: number; metodoPagamento: string; stato: string }

type VenditaFormFields = Omit<VendingVendita, "quantita" | "prezzoUnitario"> & { quantita: number | string; prezzoUnitario: number | string };
type MacchinaFormState = Omit<VendingMacchina, "id"> & { id: string | null };
interface StrutturaFormState { id: string | null; sedeCentraleId: string; }

type Modale =
  | { type: "modificaVendita"; payload: VendingVendita; prefill?: never }
  | { type: "nuovaSede"; payload: null; prefill?: never }
  | { type: "modificaSede"; payload: VendingStruttura; prefill?: never }
  | { type: "nuovaMacchina"; payload: null; prefill?: { strutturaId: string } }
  | { type: "modificaMacchina"; payload: VendingMacchina; prefill?: never };

interface ImportRisultato {
  loading: boolean;
  errore?: string;
  refresh?: boolean;
  totaleImportati?: number;
  nomeSede?: string;
  modalita?: string;
  scartati?: Array<{ riga: number; motivo: string }>;
}

interface Segmento { id: string; nome: string; colore: string; valore: number; }
interface Bucket { key: string; label: string | null; title: string; totale: number; segmenti: Segmento[]; }
interface ArticoloSegmento { id: string; nome: string; colore: string; pezzi: number; incasso: number; }
interface TopArticolo { prodotto: string; segmenti: ArticoloSegmento[]; totalePezzi: number; totaleIncasso: number; }

interface TagProps { children: React.ReactNode; className?: string; }
interface StatCardProps { label: string; value: React.ReactNode; sub?: string; icon: LucideIcon; accent: string; }
interface ModalProps { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; }
interface FieldProps { label: string; children: React.ReactNode; }
interface DashboardProps {
  vendite: VendingVendita[]; venditePeriodo: VendingVendita[];
  strutture: VendingStruttura[]; periodo: string;
  setPeriodo: (p: string) => void;
  strutturaOf: (id: string) => VendingStruttura | undefined;
}
interface VenditeProps {
  vendite: VendingVendita[]; strutture: VendingStruttura[]; macchine: VendingMacchina[];
  strutturaOf: (id: string) => VendingStruttura | undefined;
  macchinaOf: (id: string) => VendingMacchina | undefined;
  onApri: (v: VendingVendita) => void;
  onImportaFile: (file: File, strutturaId: string, modalita: string) => Promise<void>;
  importRisultato: ImportRisultato | null; onChiudiImport: () => void;
}
interface ImportaVenditeFormProps { strutture: VendingStruttura[]; onConferma: (strutturaId: string, modalita: string) => void; onClose: () => void; }
interface VenditaFormProps { esistente: VendingVendita; strutture: VendingStruttura[]; macchine: VendingMacchina[]; onSalva: (v: VendingVendita) => void; onElimina: () => void; onClose: () => void; }
interface SediProps {
  strutture: VendingStruttura[]; vendite: VendingVendita[]; macchine: VendingMacchina[];
  onNuova: () => void; onApri: (s: VendingStruttura) => void;
  onNuovaMacchina: (strutturaId: string) => void; onApriMacchina: (m: VendingMacchina) => void;
  onEliminaMacchina: (id: string) => void; onToggleMacchinaAttiva: (id: string) => void;
}
interface StrutturaFormProps { esistente: VendingStruttura | null; onSalva: (s: VendingStruttura) => void; onElimina: (() => void) | null; onClose: () => void; }
interface MacchinaFormProps { esistente: VendingMacchina | null; prefill?: { strutturaId: string }; strutture: VendingStruttura[]; onSalva: (m: VendingMacchina) => void; onElimina: (() => void) | null; onClose: () => void; }


let _id = 1000;
const nid = (p: string): string => `${p}-${_id++}`;

/* ------------------------------------------------------------------ */
/*  DATI DI PARTENZA                                                     */
/*  Monfalcone è l'unica sede con un distributore già attivo (export     */
/*  reale del sistema di telemetria, maggio–agosto 2026). Le altre tre   */
/*  strutture del gruppo restano "in arrivo" finché non installano un    */
/*  distributore: si attivano dalla sezione Sedi quando succede.         */
/* ------------------------------------------------------------------ */

const seedStrutture: VendingStruttura[] = [
  { id: "VEN-1", sedeCentraleId: "SEDE-1", nome: "Urban Homy Trieste", citta: "Trieste", attiva: false },
  { id: "VEN-2", sedeCentraleId: "SEDE-2", nome: "Urban Homy Padova", citta: "Padova", attiva: false },
  { id: "VEN-3", sedeCentraleId: "SEDE-3", nome: "Urban Homy Gorizia", citta: "Gorizia", attiva: false },
  { id: "VEN-4", sedeCentraleId: "SEDE-4", nome: "Urban Homy Monfalcone", citta: "Monfalcone", attiva: true },
];

const seedMacchine: VendingMacchina[] = [
  { id: "MAC-MFC-TCN70", strutturaId: "VEN-4", nome: "Urban Homy Supermarket Monfalcone TCN70", tipo: "Misto", attiva: true },
];

const seedVendite: VendingVendita[] = [
  { id: "VEN-MFC-1021", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:34", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1020", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:34", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1019", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:07", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1018", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:05", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1017", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:05", prodotto: "Patatina San Carlo", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1016", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:02", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1015", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:00", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1014", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "20:00", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1013", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "18:55", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1012", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "18:33", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1011", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "17:16", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1010", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "17:16", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1009", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "17:14", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1008", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "15:54", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1007", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "15:36", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1006", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-13", ora: "12:31", prodotto: "Patatina San Carlo", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1005", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "21:02", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1004", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "20:45", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1003", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "20:45", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1002", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "20:44", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1001", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "19:28", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-1000", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "19:26", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0999", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "19:15", prodotto: "Ceres Strong Ale 33 cl", quantita: 1, prezzoUnitario: 3.7, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0998", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "19:15", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0997", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "18:58", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0996", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "18:57", prodotto: "Kinder Bueno", quantita: 1, prezzoUnitario: 1.9, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0995", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "18:04", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0994", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "18:04", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0993", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "16:12", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0992", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "15:49", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0991", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "15:33", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0990", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "15:33", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0989", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "15:05", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0988", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "15:04", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0987", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-12", ora: "13:55", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0986", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "21:33", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0985", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "20:51", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0984", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "20:51", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0983", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "20:50", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0982", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "20:50", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0981", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "18:24", prodotto: "Oreo Classic", quantita: 1, prezzoUnitario: 1.6, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0980", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "18:24", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0979", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "18:24", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0978", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "15:33", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0977", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "15:33", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0976", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "14:06", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0975", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-11", ora: "14:06", prodotto: "Lion Nestlè", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0974", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "21:07", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0973", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "20:01", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0972", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "20:01", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0971", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "19:47", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0970", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "19:45", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0969", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "19:45", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0968", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "19:45", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0967", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "18:31", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0966", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "18:31", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0965", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "18:31", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0964", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "18:31", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0963", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "16:58", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0962", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "16:58", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0961", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "16:48", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0960", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "16:48", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0959", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "16:46", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0958", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "16:46", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0957", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "15:11", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0956", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "15:11", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0955", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "15:11", prodotto: "Patatina San Carlo", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0954", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "14:32", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0953", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "14:32", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0952", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "14:32", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0951", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "14:32", prodotto: "Patatina Rustica San Carlo", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0950", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "14:30", prodotto: "Golia Frutta vitamina C", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0949", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "13:36", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0948", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "13:36", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0947", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "10:54", prodotto: "Lion Nestlè", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0946", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "10:52", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0945", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-10", ora: "08:31", prodotto: "Acqua naturale Dolomia 50cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0944", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "20:55", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0943", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "19:05", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0942", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "06:21", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0941", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "06:21", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0940", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "04:15", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0939", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "04:14", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0938", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "00:20", prodotto: "Mini Prosecco Maschio", quantita: 1, prezzoUnitario: 4.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0937", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-09", ora: "00:19", prodotto: "Mini Prosecco Maschio", quantita: 1, prezzoUnitario: 4.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0936", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "23:35", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0935", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "23:33", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0934", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "23:33", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0933", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "20:57", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0932", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "20:13", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0931", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "17:07", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0930", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "17:07", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0929", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "17:07", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0928", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "14:50", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0927", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "13:09", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0926", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "13:09", prodotto: "Oreo Classic", quantita: 1, prezzoUnitario: 1.6, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0925", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "12:16", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0924", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "11:28", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0923", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-08", ora: "11:28", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0922", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "20:57", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0921", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "20:57", prodotto: "Oreo Classic", quantita: 1, prezzoUnitario: 1.6, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0920", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "20:39", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0919", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "19:39", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0918", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "18:41", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0917", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "15:31", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0916", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-07", ora: "09:32", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0915", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "19:06", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0914", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "19:06", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0913", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "19:06", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0912", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "10:21", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0911", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "09:31", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0910", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "09:16", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0909", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "09:16", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0908", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-06", ora: "09:16", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0907", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "19:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0906", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "19:11", prodotto: "Patatina San Carlo", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0905", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "18:14", prodotto: "Patatina Rustica San Carlo", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0904", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "18:14", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0903", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "16:28", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0902", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "15:41", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0901", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "15:39", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0900", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "12:48", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0899", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "12:47", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0898", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-05", ora: "12:45", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0897", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "20:17", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0896", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "19:38", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0895", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "19:38", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0894", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "19:36", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0893", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "19:36", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0892", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "18:37", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0891", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "15:09", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0890", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "14:20", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0889", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "13:28", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0888", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "13:28", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0887", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "11:11", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0886", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-04", ora: "11:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0885", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "17:48", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0884", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "16:47", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0883", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "15:52", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0882", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "12:35", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0881", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "12:35", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0880", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "11:47", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0879", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "11:47", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0878", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "09:29", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0877", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "08:03", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0876", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "08:03", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0875", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "08:03", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0874", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-03", ora: "06:03", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0873", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "21:01", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0872", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "20:00", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0871", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "19:08", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0870", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "19:08", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0869", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:54", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0868", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:40", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0867", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:33", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0866", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:33", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0865", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:33", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0864", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:33", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0863", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:28", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0862", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:28", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0861", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "18:28", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0860", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "08:25", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0859", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "06:59", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0858", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-02", ora: "06:16", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0857", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "23:54", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0856", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "23:54", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0855", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "23:54", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0854", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "22:20", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0853", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "22:16", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0852", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "21:25", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0851", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "21:25", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0850", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "21:25", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0849", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "21:25", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0848", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "20:02", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0847", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "20:02", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0846", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "19:52", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0845", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "19:39", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0844", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "19:36", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0843", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "19:34", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0842", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "18:39", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0841", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "16:37", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0840", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "16:37", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0839", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "16:37", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0838", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "14:52", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0837", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "14:52", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0836", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-08-01", ora: "06:32", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0835", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "22:21", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0834", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "17:56", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0833", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "16:10", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0832", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "16:10", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0831", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "15:18", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0830", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "10:39", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0829", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "08:17", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0828", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "08:17", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0827", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "08:12", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0826", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-31", ora: "04:45", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0825", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "22:20", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0824", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "22:20", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0823", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "22:20", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0822", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "22:09", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0821", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "22:09", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0820", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "22:07", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0819", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "21:07", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0818", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "19:37", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0817", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "19:37", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0816", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "18:24", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0815", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "17:24", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0814", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "17:00", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0813", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "16:40", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0812", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "16:40", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0811", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "15:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0810", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "15:09", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0809", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "13:38", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0808", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-30", ora: "01:54", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0807", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "20:40", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0806", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "20:40", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0805", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "20:40", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0804", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "18:49", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0803", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "18:27", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0802", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "18:23", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0801", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "18:18", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0800", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "17:13", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0799", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "17:11", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0798", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "17:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0797", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "15:12", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0796", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-29", ora: "13:27", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0795", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "21:26", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0794", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "21:26", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0793", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "20:48", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0792", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "20:47", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0791", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "20:16", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0790", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "19:51", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0789", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "19:43", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0788", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "18:46", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0787", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "17:31", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0786", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "15:48", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0785", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "15:48", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0784", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "15:48", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0783", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "15:46", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0782", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "14:51", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0781", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "14:48", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0780", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "07:15", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0779", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "06:53", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0778", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "06:52", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0777", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-28", ora: "04:14", prodotto: "Golia Frutta vitamina C", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0776", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-27", ora: "08:08", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0775", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "22:07", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0774", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:55", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0773", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:55", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0772", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:17", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0771", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:17", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0770", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:14", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0769", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:12", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0768", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "21:12", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0767", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "20:40", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0766", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "20:40", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0765", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "19:42", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0764", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "19:36", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0763", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "19:36", prodotto: "Daygum Protex azzurre", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0762", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "19:36", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0761", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "19:36", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0760", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-26", ora: "13:12", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0759", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "23:54", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0758", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "23:52", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0757", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "23:10", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0756", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "23:10", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0755", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "23:10", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0754", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "22:06", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0753", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "22:06", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0752", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:41", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0751", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:41", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0750", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:41", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0749", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:38", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0748", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:37", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0747", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:23", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0746", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:23", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0745", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "21:20", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0744", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "20:44", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0743", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "18:07", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0742", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "18:05", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0741", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "18:04", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0740", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "14:50", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0739", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "14:50", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0738", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "11:33", prodotto: "Daygum Protex azzurre", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0737", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "11:32", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0736", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "11:32", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0735", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "08:06", prodotto: "Golia Frutta vitamina C", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0734", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "08:05", prodotto: "Frisk Clean and Breath", quantita: 1, prezzoUnitario: 2.1, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0733", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-25", ora: "07:09", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0732", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "22:31", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0731", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "21:04", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0730", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "21:04", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0729", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "21:04", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0728", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "20:21", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0727", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0726", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0725", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0724", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0723", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0722", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0721", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "19:21", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0720", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "18:06", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0719", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "15:08", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0718", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "12:43", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0717", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "09:17", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0716", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-24", ora: "06:57", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0715", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "20:47", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0714", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "18:42", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0713", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "18:42", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0712", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "18:13", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0711", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "18:13", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0710", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "18:11", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0709", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "18:11", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0708", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "15:38", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0707", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-23", ora: "14:43", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0706", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "23:59", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0705", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "21:00", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0704", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "21:00", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0703", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "19:06", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0702", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "16:39", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0701", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "16:09", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0700", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "16:09", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0699", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "15:57", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0698", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "15:57", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0697", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-22", ora: "15:05", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0696", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "21:22", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0695", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "17:50", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0694", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "15:55", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0693", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "13:16", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0692", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "13:16", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0691", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "11:41", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0690", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-21", ora: "11:41", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0689", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-20", ora: "19:06", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0688", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-20", ora: "13:21", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0687", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-20", ora: "12:01", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0686", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "20:08", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0685", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "20:06", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0684", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "17:46", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0683", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "16:39", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0682", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "16:39", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0681", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "14:17", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0680", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "14:17", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0679", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "01:17", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0678", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "01:17", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0677", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-19", ora: "01:17", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0676", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "21:48", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0675", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "20:34", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0674", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "19:34", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0673", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "17:53", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0672", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "16:45", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0671", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "15:51", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0670", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "15:51", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0669", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "15:49", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0668", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "15:49", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0667", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "13:59", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0666", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "09:39", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0665", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "08:43", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0664", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-18", ora: "08:41", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0663", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "23:42", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0662", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "23:42", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0661", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "22:41", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0660", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "21:56", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0659", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "21:42", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0658", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "21:26", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0657", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "21:21", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0656", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "21:21", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0655", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "20:28", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0654", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "20:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0653", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "20:21", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0652", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "20:03", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0651", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "20:03", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0650", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "19:45", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0649", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "19:01", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0648", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "18:53", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0647", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "18:53", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0646", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "18:50", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0645", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "16:24", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0644", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "16:24", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0643", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "15:07", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0642", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "15:07", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0641", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "12:55", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0640", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-17", ora: "09:51", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0639", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "20:00", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0638", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "20:00", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0637", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "20:00", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0636", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "18:42", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0635", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "18:42", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0634", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "18:39", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0633", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "18:39", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0632", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "18:39", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0631", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "18:23", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0630", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "16:02", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0629", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "06:41", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0628", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-16", ora: "06:41", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0627", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-15", ora: "20:50", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0626", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-15", ora: "20:40", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0625", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-15", ora: "20:40", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0624", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-15", ora: "20:35", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0623", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-15", ora: "20:35", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0622", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-15", ora: "20:35", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0621", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-14", ora: "21:29", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0620", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-14", ora: "20:22", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0619", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-14", ora: "19:31", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0618", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-14", ora: "06:28", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0617", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-14", ora: "06:10", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0616", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-13", ora: "15:59", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0615", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-13", ora: "15:22", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0614", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-13", ora: "15:21", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0613", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-13", ora: "14:44", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0612", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-13", ora: "09:38", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0611", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-13", ora: "09:26", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0610", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "18:04", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0609", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "17:26", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0608", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "16:50", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0607", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "16:15", prodotto: "Daygum Protex azzurre", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0606", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "16:15", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0605", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "16:15", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0604", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "15:06", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0603", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-12", ora: "11:18", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0602", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "21:40", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0601", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "21:40", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0600", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "21:24", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0599", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "21:23", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0598", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "21:23", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0597", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "21:20", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0596", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "20:14", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0595", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "20:12", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0594", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "20:12", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0593", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "20:11", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0592", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "18:23", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0591", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "16:44", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0590", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "16:44", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0589", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "14:19", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0588", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "14:18", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0587", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "14:16", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0586", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "13:35", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0585", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-11", ora: "11:53", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0584", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-10", ora: "22:52", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0583", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-10", ora: "22:52", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0582", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-10", ora: "21:01", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0581", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-10", ora: "09:43", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0580", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "21:17", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0579", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "21:17", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0578", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "19:43", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0577", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "19:43", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0576", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "15:39", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0575", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "15:39", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0574", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "15:39", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0573", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "15:39", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0572", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "12:01", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0571", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "05:04", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0570", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-09", ora: "05:04", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0569", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "21:35", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0568", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "21:35", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0567", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "20:35", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0566", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "20:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0565", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "17:08", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0564", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "17:08", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0563", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "16:34", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0562", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "06:42", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0561", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "01:57", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0560", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "01:57", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0559", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "00:46", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0558", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-08", ora: "00:46", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0557", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-07", ora: "19:13", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0556", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-07", ora: "19:13", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0555", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-07", ora: "08:05", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0554", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-07", ora: "08:05", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0553", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "19:30", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0552", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "19:28", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0551", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "19:28", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0550", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "19:28", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0549", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "18:40", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0548", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "17:46", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0547", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "15:36", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0546", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "14:34", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0545", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-06", ora: "06:26", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0544", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-05", ora: "15:03", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0543", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-05", ora: "15:03", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0542", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-05", ora: "09:02", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0541", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "23:20", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0540", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "23:20", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0539", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "22:29", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0538", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "22:29", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0537", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "19:56", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0536", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "19:56", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0535", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "18:51", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0534", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "18:50", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0533", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "12:47", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0532", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "12:46", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0531", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "12:43", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0530", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "12:17", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0529", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-04", ora: "08:30", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0528", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "23:36", prodotto: "Chouffe Blonde 75Cl", quantita: 1, prezzoUnitario: 7.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0527", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "23:35", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0526", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "23:35", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0525", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "20:50", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0524", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "11:15", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0523", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "11:15", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0522", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-03", ora: "06:05", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0521", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "22:35", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0520", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "21:42", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0519", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:18", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0518", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:12", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0517", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:12", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0516", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:06", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0515", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:05", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0514", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:04", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0513", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "18:02", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0512", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "16:37", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0511", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "16:36", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0510", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "16:00", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0509", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "15:28", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0508", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "14:58", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0507", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "13:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0506", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-02", ora: "13:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0505", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-01", ora: "14:11", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0504", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-01", ora: "14:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0503", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-07-01", ora: "05:35", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0502", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "20:10", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0501", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "20:10", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0500", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "20:10", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0499", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "17:48", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0498", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "17:48", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0497", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "15:35", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0496", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "11:26", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0495", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "11:25", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0494", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "07:24", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0493", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "07:24", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0492", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-30", ora: "04:19", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0491", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "23:43", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0490", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "20:52", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0489", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "20:52", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0488", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "19:47", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0487", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "19:05", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0486", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "17:47", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0485", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "17:15", prodotto: "Chouffe Blonde 75Cl", quantita: 1, prezzoUnitario: 7.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0484", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "14:41", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0483", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "14:41", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0482", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "09:24", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0481", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "08:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0480", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "08:18", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0479", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-29", ora: "08:17", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0478", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:43", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0477", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:36", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0476", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:36", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0475", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:36", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0474", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:35", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0473", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:14", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0472", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:06", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0471", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "22:05", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0470", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "10:58", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0469", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-28", ora: "09:55", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0468", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "19:48", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0467", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "16:54", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0466", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "12:59", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0465", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "12:59", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0464", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "12:59", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0463", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "12:59", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0462", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "12:10", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0461", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "09:46", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0460", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "09:46", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0459", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "08:25", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0458", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "08:25", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0457", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "06:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0456", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "06:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0455", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "00:54", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0454", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-27", ora: "00:54", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0453", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "21:14", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0452", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "21:09", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0451", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "20:28", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0450", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "20:28", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0449", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "15:29", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0448", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "12:09", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0447", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "10:58", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0446", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "08:13", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0445", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "08:13", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0444", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-26", ora: "01:08", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0443", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "21:12", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0442", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "21:10", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0441", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "19:25", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0440", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "19:25", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0439", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "19:25", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0438", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "18:33", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0437", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "18:06", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0436", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "18:06", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0435", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "16:46", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0434", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "16:46", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0433", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "16:46", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0432", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "16:05", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0431", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "16:03", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0430", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "15:07", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0429", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "15:07", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0428", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "15:00", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0427", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "15:00", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0426", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "14:33", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0425", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "14:33", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0424", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "14:20", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0423", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "14:20", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0422", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "14:20", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0421", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "13:46", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0420", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "13:46", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0419", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "13:29", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0418", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "13:29", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0417", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "12:42", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0416", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "12:24", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0415", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "12:24", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0414", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "12:24", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0413", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "12:09", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0412", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-25", ora: "09:51", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0411", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "20:54", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0410", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "20:54", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0409", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "20:54", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0408", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "20:54", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0407", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "19:46", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0406", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "19:46", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0405", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "19:36", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0404", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "19:06", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0403", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "19:06", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0402", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "19:06", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0401", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "15:18", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0400", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "15:12", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0399", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "14:05", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0398", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "13:32", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0397", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "13:32", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0396", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "13:32", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0395", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "13:31", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0394", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "13:31", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0393", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "06:23", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0392", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:41", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0391", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:41", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0390", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:41", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0389", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:41", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0388", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:18", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0387", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:18", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0386", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-24", ora: "02:18", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0385", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "22:29", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0384", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "22:29", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0383", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "22:29", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0382", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "22:29", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0381", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "20:08", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0380", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "19:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0379", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "19:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0378", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "16:03", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0377", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "16:03", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0376", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "13:52", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0375", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "13:52", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0374", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "13:52", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0373", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "13:52", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0372", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "13:02", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0371", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-23", ora: "00:00", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0370", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "18:10", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0369", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "18:09", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0368", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "15:39", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0367", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "15:27", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0366", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "15:25", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0365", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "15:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0364", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-22", ora: "10:23", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0363", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "22:20", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0362", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "22:20", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0361", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "22:20", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0360", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "22:20", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0359", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "22:01", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0358", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "22:01", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0357", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "07:38", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0356", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-21", ora: "06:25", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0355", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "22:57", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0354", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "22:27", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0353", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "22:24", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0352", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "20:29", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0351", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "20:12", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0350", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "20:12", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0349", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "19:33", prodotto: "Golia Frutta vitamina C", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0348", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "19:33", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0347", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "19:33", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0346", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "19:32", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0345", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "13:43", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0344", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "13:39", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0343", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "13:04", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0342", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-20", ora: "11:47", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0341", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "22:09", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0340", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "16:58", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0339", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "15:55", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0338", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "13:48", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0337", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "13:48", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0336", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "13:25", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0335", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "11:49", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0334", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "11:49", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0333", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "10:18", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0332", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-19", ora: "10:18", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0331", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "22:52", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0330", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "22:49", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0329", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "22:48", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0328", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "21:50", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0327", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "21:50", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0326", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "19:13", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0325", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "19:13", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0324", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "17:18", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0323", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "09:16", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0322", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-18", ora: "09:16", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0321", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-17", ora: "17:59", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0320", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-17", ora: "12:56", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0319", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-16", ora: "19:43", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0318", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-16", ora: "19:43", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0317", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-16", ora: "16:11", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0316", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-16", ora: "15:24", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0315", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-16", ora: "15:24", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0314", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-16", ora: "15:24", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0313", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-15", ora: "18:51", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0312", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-15", ora: "18:50", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0311", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-15", ora: "01:08", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0310", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-14", ora: "23:28", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0309", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-14", ora: "20:42", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0308", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-14", ora: "03:10", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0307", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-13", ora: "22:16", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0306", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-13", ora: "21:23", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0305", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-13", ora: "21:23", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0304", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-13", ora: "19:47", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0303", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-13", ora: "19:47", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0302", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-13", ora: "17:23", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0301", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "22:33", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0300", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "21:18", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0299", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "21:18", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0298", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "19:01", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0297", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "19:01", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0296", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "19:00", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0295", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "18:48", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0294", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "18:13", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0293", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "11:45", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0292", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "07:30", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0291", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "07:30", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0290", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-12", ora: "00:53", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0289", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-11", ora: "18:40", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0288", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-11", ora: "18:39", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0287", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-11", ora: "18:39", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0286", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-11", ora: "15:10", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0285", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-11", ora: "12:53", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0284", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "20:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0283", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "20:11", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0282", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "20:11", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0281", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "20:05", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0280", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:42", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0279", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:42", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0278", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:39", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0277", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:39", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0276", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:39", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0275", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:39", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0274", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "18:36", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0273", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "08:36", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0272", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "04:24", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0271", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-10", ora: "04:24", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0270", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "22:16", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0269", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "22:16", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0268", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "21:57", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0267", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "21:57", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0266", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "19:50", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0265", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "19:15", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0264", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "16:22", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0263", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "16:22", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0262", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "16:22", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0261", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "16:22", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0260", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "15:45", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0259", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "15:44", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0258", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "15:42", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0257", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-09", ora: "15:42", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0256", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "23:19", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0255", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "21:54", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0254", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "20:02", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0253", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "20:01", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0252", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "20:00", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0251", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "18:29", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0250", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-08", ora: "17:08", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0249", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-07", ora: "19:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0248", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-07", ora: "18:42", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0247", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-07", ora: "08:20", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0246", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-07", ora: "08:20", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0245", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-07", ora: "08:09", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0244", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "21:06", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0243", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "21:06", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0242", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "20:44", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0241", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "20:44", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0240", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "18:51", prodotto: "Chouffe Blonde 75Cl", quantita: 1, prezzoUnitario: 6, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0239", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "18:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0238", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "18:21", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0237", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:55", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0236", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:25", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0235", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:25", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0234", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:05", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0233", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:05", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0232", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:05", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0231", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:03", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0230", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:03", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0229", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:02", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0228", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:02", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0227", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:00", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0226", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "17:00", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0225", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "08:23", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0224", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-06", ora: "08:23", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0223", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "22:00", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0222", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "22:00", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0221", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "21:25", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0220", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "21:25", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0219", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "21:25", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0218", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "19:33", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0217", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "19:00", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0216", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-05", ora: "19:00", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0215", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "22:04", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0214", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "21:34", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0213", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "21:34", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0212", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "20:43", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0211", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "16:20", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0210", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "16:20", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0209", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "15:07", prodotto: "Chouffe Blonde 75Cl", quantita: 1, prezzoUnitario: 6, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0208", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "06:06", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0207", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "06:06", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0206", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "04:58", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0205", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-04", ora: "01:03", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0204", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "13:57", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0203", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "11:26", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0202", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "11:26", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0201", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "11:26", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0200", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "09:44", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0199", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "09:44", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0198", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "09:44", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0197", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "09:44", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0196", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "06:31", prodotto: "Frisk Clean and Breath", quantita: 1, prezzoUnitario: 2.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0195", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "06:01", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0194", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-03", ora: "04:54", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0193", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-06-02", ora: "14:33", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0192", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "23:23", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0191", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "23:23", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0190", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "22:29", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0189", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "22:29", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0188", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "20:48", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0187", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "16:00", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0186", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "16:00", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0185", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "16:00", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0184", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "16:00", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0183", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "13:50", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0182", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "13:50", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0181", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "13:50", prodotto: "Frisk Clean and Breath", quantita: 1, prezzoUnitario: 2.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0180", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:25", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0179", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:25", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0178", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:22", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0177", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:22", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0176", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:22", prodotto: "Frisk Clean and Breath", quantita: 1, prezzoUnitario: 2.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0175", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:02", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0174", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "10:02", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0173", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "09:50", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0172", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "08:30", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0171", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-31", ora: "01:18", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0170", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:32", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0169", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:32", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0168", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:32", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0167", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:32", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0166", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:32", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0165", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:32", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0164", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:18", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0163", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:18", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0162", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "23:18", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0161", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "22:51", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0160", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "22:51", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0159", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "22:50", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0158", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "22:50", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0157", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "21:50", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0156", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "21:50", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0155", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "21:50", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0154", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "20:53", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0153", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "18:41", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0152", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "18:41", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0151", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "18:41", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0150", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "18:41", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0149", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "15:22", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0148", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "15:22", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0147", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "15:22", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0146", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "15:22", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0145", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "14:23", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0144", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "14:16", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0143", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "14:13", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0142", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "10:50", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0141", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "10:50", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0140", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "10:46", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0139", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-30", ora: "10:46", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0138", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "23:13", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0137", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "23:13", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0136", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "23:08", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0135", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "18:58", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0134", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "18:58", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0133", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "14:52", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0132", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "14:52", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0131", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-29", ora: "14:52", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0130", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "22:33", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0129", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "22:32", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0128", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "22:11", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0127", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "20:22", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0126", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "20:22", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0125", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "20:22", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0124", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "20:09", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0123", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "20:09", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0122", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "00:37", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0121", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "00:24", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0120", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-28", ora: "00:24", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0119", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-27", ora: "06:53", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0118", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-27", ora: "06:53", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0117", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "22:32", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0116", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "21:32", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0115", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "21:32", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0114", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "21:02", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0113", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "21:02", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0112", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "04:58", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0111", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "03:17", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0110", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "03:17", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0109", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "03:17", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0108", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "00:19", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0107", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "00:19", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0106", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-26", ora: "00:19", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0105", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "21:50", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0104", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "20:05", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0103", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "20:05", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0102", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "19:18", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0101", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "18:28", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0100", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "18:28", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0099", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-25", ora: "13:41", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0098", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-24", ora: "22:45", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0097", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-24", ora: "21:11", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0096", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-24", ora: "20:26", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0095", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-24", ora: "20:26", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0094", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:50", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0093", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:18", prodotto: "SKIPPER Succo d'ananas senza zuccheri brik 33 cl", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0092", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:18", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0091", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:14", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0090", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:14", prodotto: "Golia Frutta vitamina C", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0089", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:14", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0088", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:14", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0087", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "22:14", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0086", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "20:58", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0085", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "20:14", prodotto: "Chouffe Blonde 75Cl", quantita: 1, prezzoUnitario: 6, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0084", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "20:07", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0083", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "20:07", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0082", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "20:07", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0081", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:57", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0080", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:57", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0079", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:57", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0078", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:47", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0077", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:47", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0076", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:47", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0075", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "19:47", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0074", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "16:43", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0073", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "16:43", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0072", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "11:08", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0071", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-23", ora: "11:08", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0070", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "21:33", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0069", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "21:33", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0068", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "19:41", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0067", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "19:41", prodotto: "Baiocchi biscotti 3x ", quantita: 1, prezzoUnitario: 1.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0066", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "19:27", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0065", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "15:41", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0064", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:37", prodotto: "Red Bull", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0063", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:37", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0062", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:37", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0061", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:37", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0060", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:36", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0059", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:32", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0058", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:30", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0057", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:20", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0056", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "13:18", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0055", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-22", ora: "08:09", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0054", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-21", ora: "21:02", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0053", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-21", ora: "21:02", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0052", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-21", ora: "21:02", prodotto: "Tourtel birra analcolica 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0051", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-21", ora: "21:02", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0050", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-21", ora: "14:28", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0049", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-21", ora: "14:28", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0048", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-20", ora: "22:39", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0047", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-20", ora: "22:38", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0046", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-20", ora: "20:51", prodotto: "Tennent's 33cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0045", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-20", ora: "19:33", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0044", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-20", ora: "15:10", prodotto: "Lipton Ice Tea pesca 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0043", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-19", ora: "17:08", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0042", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-06", ora: "15:19", prodotto: "Red Bull zero 250ml", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0041", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-06", ora: "13:49", prodotto: "Peroni 33 cl", quantita: 1, prezzoUnitario: 3, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0040", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "21:23", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0039", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "21:21", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0038", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "21:20", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0037", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "20:54", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0036", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "20:54", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0035", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "20:54", prodotto: "Leffe Rouge 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0034", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "20:19", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0033", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-05", ora: "20:19", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0032", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-04", ora: "19:32", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0031", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-04", ora: "14:48", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0030", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-03", ora: "20:02", prodotto: "Acqua San Pellegrino Frizzante 75cl", quantita: 1, prezzoUnitario: 2.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0029", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-02", ora: "23:44", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0028", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-02", ora: "22:30", prodotto: "Acqua Naturale San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0027", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-02", ora: "18:09", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0026", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-02", ora: "18:09", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0025", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-02", ora: "18:09", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0024", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-02", ora: "13:41", prodotto: "Patatine Highlander barbecue San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0023", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-01", ora: "22:23", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0022", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-01", ora: "20:10", prodotto: "Acqua panna 75cl", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0021", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-05-01", ora: "10:55", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0020", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-30", ora: "19:19", prodotto: "San Carlo 1936 Antica Ricetta 40gr", quantita: 1, prezzoUnitario: 1.1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0019", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-30", ora: "19:19", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0018", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-30", ora: "17:09", prodotto: "M E M'S ARACHIDI 45GR", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0017", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-29", ora: "20:26", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0016", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-29", ora: "20:26", prodotto: "Fanta orange 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0015", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-29", ora: "12:18", prodotto: "Coca Cola Zero 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0014", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-29", ora: "11:36", prodotto: "Mars", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0013", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-29", ora: "03:01", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0012", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-29", ora: "02:56", prodotto: "Kit Kat", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0011", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-28", ora: "18:09", prodotto: "Patatine Highlander pomodoro San Carlo", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0010", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-28", ora: "18:07", prodotto: "Twix", quantita: 1, prezzoUnitario: 1.8, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0009", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2026-04-21", ora: "15:23", prodotto: "Fonzies Original", quantita: 1, prezzoUnitario: 1, metodoPagamento: "Carta", stato: "NonErogata" },
  { id: "VEN-MFC-0008", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "21:44", prodotto: "Acqua Frizzante San Benedetto 50 cl", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0007", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "20:36", prodotto: "Succo Skipper Ace 33 cl brik", quantita: 1, prezzoUnitario: 2.2, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0006", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "20:17", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0005", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "20:16", prodotto: "Moretti 33 cl", quantita: 1, prezzoUnitario: 3.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0004", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "17:12", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0003", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "17:12", prodotto: "Ringo Vaniglia", quantita: 1, prezzoUnitario: 1.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0002", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "14:07", prodotto: "Coca Cola 450ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
  { id: "VEN-MFC-0001", strutturaId: "VEN-4", macchinaId: "MAC-MFC-TCN70", macchinaNome: "", data: "2013-01-18", ora: "08:52", prodotto: "Lipton Ice Tea limone 500ml pet", quantita: 1, prezzoUnitario: 2.5, metodoPagamento: "Carta", stato: "Completata" },
];

/* ------------------------------------------------------------------ */
/*  COSTANTI                                                             */
/* ------------------------------------------------------------------ */

const oggi = new Date();

const TIPI_MACCHINA = ["Snack", "Bevande fredde", "Caffè", "Misto"];
const METODI_PAGAMENTO = ["Contante", "Carta", "App"];
const metodoIcon: Record<string, LucideIcon> = { Contante: Banknote, Carta: CreditCard, App: Smartphone };

// Colori distinti per sede nel grafico a barre impilate del cruscotto,
// assegnati per posizione (ciclici se le sedi superano la tavolozza).
const PALETTE_SEDI: string[] = ["#CA8A04", "#0EA5E9", "#DC2626", "#16A34A", "#7C3AED", "#DB2777", "#EA580C", "#0D9488"];
function coloreSede(strutture: VendingStruttura[], strutturaId: string): string {
  const idx = strutture.findIndex((s) => s.id === strutturaId);
  return PALETTE_SEDI[idx < 0 ? 0 : idx % PALETTE_SEDI.length];
}

// Non tutte le vendite tentate vanno a buon fine: la macchina può addebitare
// il pagamento senza erogare il prodotto (guasto/incastro), nel qual caso va
// rimborsato il cliente. Solo le vendite "Completata" contano come incasso
// reale ed entrano nelle statistiche.
const STATI_VENDITA = ["Completata", "NonErogata", "Rimborsata"];
const STATI_VENDITA_LABEL: Record<string, string> = { Completata: "Completata", NonErogata: "Non erogata", Rimborsata: "Rimborsata" };
const statoVenditaColor: Record<string, string> = {
  Completata: "bg-emerald-600 text-white",
  NonErogata: "bg-rose-500 text-white",
  Rimborsata: "bg-amber-500 text-white",
};
const statoVenditaIcon: Record<string, LucideIcon> = { Completata: CheckCircle2, NonErogata: AlertTriangle, Rimborsata: RotateCcw };

const PERIODI = [
  { id: "7g", label: "Ultimi 7 giorni", giorni: 7 },
  { id: "30g", label: "Ultimo mese", giorni: 30 },
  { id: "tutto", label: "Tutto", giorni: null },
];

function totaleVendita(v: VendingVendita): number { return (Number(v.prezzoUnitario) || 0) * (Number(v.quantita) || 0); }
function incassato(v: VendingVendita): number { return v.stato === "Completata" ? totaleVendita(v) : 0; }
function fmtEuro(n: number): string { return "€ " + (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtData(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDataBreve(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}
function inPeriodo(iso: string, periodoId: string): boolean {
  const p = PERIODI.find((x) => x.id === periodoId);
  if (!p || p.giorni === null) return true;
  const cutoff = new Date(oggi); cutoff.setDate(cutoff.getDate() - (p.giorni - 1));
  return iso >= cutoff.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  MACCHINE — censimento fisico per sede                               */
/*  Censimento volutamente vuoto: si compila sede per sede dalla        */
/*  sezione Sedi, indicando quali distributori sono installati.         */
/* ------------------------------------------------------------------ */

function macchineTotaliPerTipo(macchine: VendingMacchina[], strutturaId: string): Record<string, number> {
  const totali = {};
  TIPI_MACCHINA.forEach((t) => { totali[t] = 0; });
  macchine.filter((m) => m.strutturaId === strutturaId).forEach((m) => {
    if (totali[m.tipo] !== undefined) totali[m.tipo] += 1;
  });
  return totali;
}

/* ------------------------------------------------------------------ */
/*  IMPORT VENDITE DA EXCEL                                             */
/* ------------------------------------------------------------------ */

const METODO_ALIAS = {
  "contante": "Contante", "cash": "Contante", "contanti": "Contante", "moneta": "Contante",
  "carta": "Carta", "card": "Carta", "carta di credito": "Carta", "credit card": "Carta", "pos": "Carta", "bancomat": "Carta",
  "app": "App", "mobile": "App", "satispay": "App", "app pagamento": "App", "qr": "App",
};
const CAMPI_ALIAS_VENDITE = {
  macchinaNome: ["macchina", "distributore", "vending machine", "device", "erogatore", "colonnina"],
  data: ["data", "date", "data vendita", "giorno"],
  ora: ["ora", "time", "orario"],
  prodotto: ["prodotto", "articolo", "item", "product", "referenza", "descrizione"],
  quantita: ["quantita", "qty", "pezzi", "quantità", "qta"],
  prezzoUnitario: ["prezzo", "prezzo unitario", "importo unitario", "price", "importo", "totale eur"],
  metodoPagamento: ["pagamento", "metodo pagamento", "metodo di pagamento", "canale", "payment method", "tipo pagamento"],
  erogato: ["erogato", "dispensato", "delivered", "dispensed", "esito"],
  rimborso: ["rimborso", "rimborsato", "refund", "refunded"],
};

const DIACRITICI_RE = new RegExp("[\\u0300-\\u036f]", "g");
function normalizeTesto(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD").replace(DIACRITICI_RE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function trovaCampo(rigaNorm: Record<string, unknown>, chiavi: string[]): unknown {
  for (const k of chiavi) {
    if (rigaNorm[k] !== undefined && rigaNorm[k] !== "") return rigaNorm[k];
  }
  return undefined;
}
function excelDataToIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}
function excelOraToHHMM(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toTimeString().slice(0, 5);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  const n = Number(s);
  if (!Number.isNaN(n) && n >= 0 && n < 1) {
    const totMin = Math.round(n * 24 * 60);
    return `${String(Math.floor(totMin / 60)).padStart(2, "0")}:${String(totMin % 60).padStart(2, "0")}`;
  }
  return "";
}
function matchMetodoPagamento(v: unknown): string {
  const norm = normalizeTesto(v);
  if (METODO_ALIAS[norm]) return METODO_ALIAS[norm];
  return METODI_PAGAMENTO.includes(v) ? v : "Contante";
}
// Interpreta valori si/no, true/false, 1/0 in colonne booleane del foglio.
// Restituisce null se il valore non è riconoscibile (campo assente/ambiguo).
function matchSiNo(v: unknown): boolean | null {
  const norm = normalizeTesto(v);
  if (["si", "yes", "true", "1", "ok"].includes(norm)) return true;
  if (["no", "false", "0"].includes(norm)) return false;
  return null;
}

// Analizza le righe grezze lette dal foglio Excel (una per vendita) e le
// converte nella forma usata dall'app, riconoscendo intestazioni di
// colonna comuni indipendentemente da maiuscole/accenti/lingua. La sede è
// scelta esplicitamente dall'utente prima dell'import (non dedotta dal
// file), perché un export riguarda tipicamente un solo distributore/sede.
function parseFoglioVendite(righeGrezze: Record<string, unknown>[], strutturaId: string, macchine: VendingMacchina[]): { vendite: VendingVendita[]; scartati: Array<{riga: number; motivo: string}> } {
  const risultato = { vendite: [], scartati: [] };
  righeGrezze.forEach((riga, idx) => {
    const norm: Record<string, unknown> = {};
    Object.entries(riga).forEach(([k, v]) => { norm[normalizeTesto(k)] = v; });

    const prodotto = trovaCampo(norm, CAMPI_ALIAS_VENDITE.prodotto);
    const dataRaw = trovaCampo(norm, CAMPI_ALIAS_VENDITE.data);

    if (!prodotto || !String(prodotto).trim()) {
      risultato.scartati.push({ riga: idx + 2, motivo: "prodotto mancante" });
      return;
    }
    if (!dataRaw) {
      risultato.scartati.push({ riga: idx + 2, motivo: "data mancante" });
      return;
    }

    // Se la macchina non è ancora censita in Sedi, si conserva comunque il
    // nome grezzo del file per non perdere l'informazione in tabella.
    const macchinaNomeRaw = trovaCampo(norm, CAMPI_ALIAS_VENDITE.macchinaNome);
    const macchinaNomeGrezzo = macchinaNomeRaw ? String(macchinaNomeRaw).trim() : "";
    const macchinaMatch = macchine.find((m) => m.strutturaId === strutturaId && normalizeTesto(m.nome) === normalizeTesto(macchinaNomeRaw));

    const data = excelDataToIso(dataRaw);
    const ora = excelOraToHHMM(trovaCampo(norm, CAMPI_ALIAS_VENDITE.ora)) || "00:00";
    const quantitaRaw = trovaCampo(norm, CAMPI_ALIAS_VENDITE.quantita);
    const quantita = Number(String(quantitaRaw ?? "1").replace(",", ".")) || 1;
    const prezzoRaw = trovaCampo(norm, CAMPI_ALIAS_VENDITE.prezzoUnitario);
    const prezzoUnitario = Number(String(prezzoRaw ?? "0").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
    const metodoPagamento = matchMetodoPagamento(trovaCampo(norm, CAMPI_ALIAS_VENDITE.metodoPagamento) ?? "Contante");
    const erogato = matchSiNo(trovaCampo(norm, CAMPI_ALIAS_VENDITE.erogato));
    const rimborso = matchSiNo(trovaCampo(norm, CAMPI_ALIAS_VENDITE.rimborso));
    const stato = rimborso === true ? "Rimborsata" : erogato === false ? "NonErogata" : "Completata";

    risultato.vendite.push({
      id: nid("VEN"), strutturaId, macchinaId: macchinaMatch?.id || "", macchinaNome: macchinaMatch ? "" : macchinaNomeGrezzo,
      data, ora, prodotto: String(prodotto).trim(), quantita, prezzoUnitario, metodoPagamento, stato,
    });
  });
  return risultato;
}

/* ------------------------------------------------------------------ */
/*  COMPONENTI DI SUPPORTO                                              */
/* ------------------------------------------------------------------ */

function Tag({ children, className = "" }: TagProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 shadow-sm">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-stone-900 leading-none font-[Fraunces] truncate">{value}</div>
        <div className="text-xs text-stone-500 mt-1 tracking-wide uppercase">{label}</div>
        {sub && <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e) {
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

function Field({ label, children }: FieldProps) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

// Come Field, ma con un <div> invece di <label>: da usare quando il contenuto
// ha più di un controllo interattivo, altrimenti un click su un input
// attiverebbe anche il focus/toggle del primo elemento interno.
function FieldGroup({ label, children }: FieldProps) {
  return (
    <div className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#CA8A04]/40 focus:border-[#CA8A04]";

/* ------------------------------------------------------------------ */
/*  APP                                                                  */
/* ------------------------------------------------------------------ */

export default function App() {
  const [strutture, setStrutture] = useSyncedResource(api.strutture, seedStrutture);
  const [macchine, setMacchine] = useSyncedResource(api.macchine, seedMacchine);
  const [vendite, setVendite] = useSyncedResource(api.vendite, seedVendite);
  const backendOffline = useBackendOffline();

  const [tab, setTab] = useState<string>("dashboard");
  const TAB_IMPOSTAZIONI = ["sedi"];
  const [impostazioniAperte, setImpostazioniAperte] = useState<boolean>(TAB_IMPOSTAZIONI.includes(tab));
  const [modale, setModale] = useState<Modale | null>(null);
  const [periodo, setPeriodo] = useState<string>("tutto");
  const [importRisultato, setImportRisultato] = useState<ImportRisultato | null>(null);

  const [sessione] = useState<UHAccount | null>(() => UHAccounts.loadSession());
  const puoAccedere = UHAccounts.hasAccesso(sessione, APP_ID);
  const isAdminApp = UHAccounts.ruoloIn(sessione, APP_ID) === "Amministratore";

  useEffect(() => {
    if (!isAdminApp && TAB_IMPOSTAZIONI.includes(tab)) setTab("dashboard");
  }, [isAdminApp, tab]);

  const strutturaOf = (id: string): VendingStruttura | undefined => strutture.find((s) => s.id === id);
  const macchinaOf = (id: string): VendingMacchina | undefined => macchine.find((m) => m.id === id);

  function salvaVendita(dati) {
    setVendite((vs) => vs.map((v) => (v.id === dati.id ? dati : v)));
    setModale(null);
  }
  function eliminaVendita(id) {
    setVendite((vs) => vs.filter((v) => v.id !== id));
    setModale(null);
  }
  function salvaStruttura(dati) {
    if (dati.id) {
      setStrutture((ss) => ss.map((s) => (s.id === dati.id ? dati : s)));
    } else {
      setStrutture((ss) => [...ss, { ...dati, id: nid("VSTR") }]);
    }
    setModale(null);
  }
  function eliminaStruttura(id) {
    setStrutture((ss) => ss.filter((s) => s.id !== id));
    setModale(null);
  }

  function salvaMacchina(dati) {
    if (dati.id) {
      setMacchine((ms) => ms.map((m) => (m.id === dati.id ? dati : m)));
    } else {
      setMacchine((ms) => [...ms, { ...dati, id: nid("MAC") }]);
    }
    setModale(null);
  }
  function eliminaMacchina(id) {
    setMacchine((ms) => ms.filter((m) => m.id !== id));
    setModale(null);
  }
  function toggleMacchinaAttiva(id) {
    setMacchine((ms) => ms.map((m) => (m.id === id ? { ...m, attiva: m.attiva === false } : m)));
  }

  // Importa vendite da un file Excel (.xlsx/.xls/.csv) per una sede scelta
  // esplicitamente dall'utente (un export riguarda tipicamente un solo
  // distributore/sede, quindi non si tenta di dedurla dal file). L'utente
  // sceglie anche la modalità: "sostituzione" rimpiazza solo le vendite già
  // presenti per quella sede, "aggiunta" accoda le nuove senza toccare le
  // altre.
  async function importaVenditeDaFile(file, strutturaId, modalita) {
    setImportRisultato({ loading: true });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const foglio = wb.Sheets[wb.SheetNames[0]];
      const righe = XLSX.utils.sheet_to_json(foglio, { defval: "" }) as Record<string, unknown>[];
      const { vendite: righeValide, scartati } = parseFoglioVendite(righe, strutturaId, macchine);

      if (righeValide.length === 0) {
        setImportRisultato({ loading: false, errore: "Nessuna vendita valida trovata nel file.", scartati });
        return;
      }

      const nomeSede = strutturaOf(strutturaId)?.nome ?? "";
      if (modalita === "sostituzione") {
        setVendite((vs) => [...righeValide, ...vs.filter((v) => v.strutturaId !== strutturaId)]);
      } else {
        setVendite((vs) => [...righeValide, ...vs]);
      }
      setImportRisultato({
        loading: false, refresh: true, totaleImportati: righeValide.length, scartati,
        nomeSede, modalita,
      });
    } catch (err) {
      setImportRisultato({ loading: false, errore: "File non leggibile. Verifica che sia un foglio Excel (.xlsx/.xls) o CSV valido." });
    }
  }

  // Il cruscotto mostra solo le sedi che hanno almeno una macchina attiva:
  // quelle senza distributori (o con tutti spenti/rimossi) non hanno dati
  // reali da mostrare, quindi vengono escluse da statistiche, grafico e sedi.
  const idsConMacchinaAttiva = useMemo(() => new Set(macchine.filter((m) => m.attiva !== false).map((m) => m.strutturaId)), [macchine]);
  const struttureConMacchine = useMemo(() => strutture.filter((s) => idsConMacchinaAttiva.has(s.id)), [strutture, idsConMacchinaAttiva]);
  const venditeConMacchina = useMemo(() => vendite.filter((v) => idsConMacchinaAttiva.has(v.strutturaId)), [vendite, idsConMacchinaAttiva]);
  const venditePeriodo = useMemo(() => venditeConMacchina.filter((v) => inPeriodo(v.data, periodo)), [venditeConMacchina, periodo]);

  if (!puoAccedere) {
    return (
      <div className="min-h-screen w-full bg-[#F3F0E8] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-[#1F1A12] flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={26} className="text-white" />
          </div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
          <p className="text-stone-500 text-sm mb-6">
            {sessione
              ? "Il tuo account non ha accesso all'applicazione Vending Machine. Contatta un amministratore del portale."
              : "Devi accedere dalla home page del portale per usare questa applicazione."}
          </p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#1F1A12] hover:bg-[#150F0A] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
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
        <aside className="md:w-60 shrink-0 bg-[#1F1A12] text-stone-200 flex md:flex-col">
          <div className="px-5 py-5 border-b border-white/10 hidden md:block">
            <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3">
              <ArrowLeft size={12} /> Applicazioni Urban Homy
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#CA8A04] flex items-center justify-center">
                <ShoppingCart size={16} className="text-white" />
              </div>
              <div>
                <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Vending Machine</div>
                <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · incassi distributori</div>
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
              { id: "vendite", label: "Vendite", icon: ShoppingCart },
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
                  {[{ id: "sedi", label: "Sedi", icon: MapPin }].map((t) => (
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
          <div className="px-5 py-3 text-[11px] text-stone-500 hidden md:block border-t border-white/10 mt-auto">
            {strutture.filter((s) => s.attiva).length} sedi attive · {vendite.length} vendite registrate
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
          {tab === "dashboard" && (
            <Dashboard
              vendite={venditeConMacchina}
              venditePeriodo={venditePeriodo}
              strutture={struttureConMacchine}
              periodo={periodo}
              setPeriodo={setPeriodo}
              strutturaOf={strutturaOf}
            />
          )}

          {tab === "vendite" && (
            <Vendite
              vendite={vendite}
              strutture={strutture}
              macchine={macchine}
              strutturaOf={strutturaOf}
              macchinaOf={macchinaOf}
              onApri={(v) => setModale({ type: "modificaVendita", payload: v })}
              onImportaFile={importaVenditeDaFile}
              importRisultato={importRisultato}
              onChiudiImport={() => setImportRisultato(null)}
            />
          )}

          {tab === "sedi" && (
            <Sedi
              strutture={strutture}
              vendite={vendite}
              macchine={macchine}
              onNuova={() => setModale({ type: "nuovaSede", payload: null })}
              onApri={(s) => setModale({ type: "modificaSede", payload: s })}
              onNuovaMacchina={(strutturaId) => setModale({ type: "nuovaMacchina", payload: null, prefill: { strutturaId } })}
              onApriMacchina={(m) => setModale({ type: "modificaMacchina", payload: m })}
              onEliminaMacchina={eliminaMacchina}
              onToggleMacchinaAttiva={toggleMacchinaAttiva}
            />
          )}

        </main>
      </div>

      {modale?.type === "modificaVendita" && (
        <VenditaForm
          esistente={modale.payload}
          strutture={strutture}
          macchine={macchine}
          onSalva={salvaVendita}
          onElimina={() => eliminaVendita(modale.payload.id)}
          onClose={() => setModale(null)}
        />
      )}

      {(modale?.type === "nuovaSede" || modale?.type === "modificaSede") && (
        <StrutturaForm
          esistente={modale.payload}
          onSalva={salvaStruttura}
          onElimina={modale.payload ? () => eliminaStruttura(modale.payload.id) : null}
          onClose={() => setModale(null)}
        />
      )}

      {(modale?.type === "nuovaMacchina" || modale?.type === "modificaMacchina") && (
        <MacchinaForm
          esistente={modale.payload}
          prefill={modale.prefill}
          strutture={strutture}
          onSalva={salvaMacchina}
          onElimina={modale.payload ? () => eliminaMacchina(modale.payload.id) : null}
          onClose={() => setModale(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                           */
/* ------------------------------------------------------------------ */

function Dashboard({ vendite, venditePeriodo, strutture, periodo, setPeriodo, strutturaOf }: DashboardProps) {
  // Le card sede fungono da filtro: si parte con tutte le sedi (con macchine
  // attive) selezionate, e un click le include/esclude dai totali, dal
  // grafico e dagli articoli più venduti qui sotto.
  const [sediSelezionate, setSediSelezionate] = useState<Set<string>>(() => new Set(strutture.map((s) => s.id)));
  useEffect(() => {
    setSediSelezionate((prev) => {
      let cambiato = false;
      const next = new Set(prev);
      strutture.forEach((s) => { if (!next.has(s.id)) { next.add(s.id); cambiato = true; } });
      return cambiato ? next : prev;
    });
  }, [strutture]);
  function toggleSede(id) {
    setSediSelezionate((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const venditeFiltrate = useMemo(() => vendite.filter((v) => sediSelezionate.has(v.strutturaId)), [vendite, sediSelezionate]);
  const venditePeriodoFiltrate = useMemo(() => venditePeriodo.filter((v) => sediSelezionate.has(v.strutturaId)), [venditePeriodo, sediSelezionate]);

  const stats = useMemo(() => {
    const completate = venditePeriodoFiltrate.filter((v) => v.stato === "Completata");
    const nonErogate = venditePeriodoFiltrate.filter((v) => v.stato === "NonErogata");
    const totaleIncasso = completate.reduce((s, v) => s + totaleVendita(v), 0);
    const totalePezzi = completate.reduce((s, v) => s + (Number(v.quantita) || 0), 0);
    return {
      totaleIncasso,
      nVendite: completate.length,
      nNonErogate: nonErogate.length,
      totalePezzi,
      mediaPerVendita: completate.length ? totaleIncasso / completate.length : 0,
    };
  }, [venditePeriodoFiltrate]);

  const giorniGrafico = useMemo(() => {
    const p = PERIODI.find((x) => x.id === periodo);
    if (p && p.giorni !== null) return p.giorni;
    const date = venditeFiltrate.map((v) => v.data).filter(Boolean).sort();
    if (date.length === 0) return 30;
    const primo = new Date(date[0] + "T00:00:00");
    const giorni = Math.round((oggi.getTime() - primo.getTime()) / 86400000) + 1;
    return Math.min(180, Math.max(7, giorni));
  }, [periodo, venditeFiltrate]);

  const [raggruppamento, setRaggruppamento] = useState<string>("giorno");

  // Ogni sede selezionata ha un colore fisso (assegnato per posizione tra
  // tutte le sedi, non solo quelle selezionate, così un colore non cambia
  // quando si include/esclude un'altra sede) per impilare le barre.
  const sediPerSegmenti = useMemo(() => strutture.filter((s) => sediSelezionate.has(s.id)), [strutture, sediSelezionate]);
  function segmentiDi(bucketVendite) {
    return sediPerSegmenti.map((s) => ({
      id: s.id,
      nome: s.nome,
      colore: coloreSede(strutture, s.id),
      valore: bucketVendite.filter((v) => v.strutturaId === s.id).reduce((sum, v) => sum + incassato(v), 0),
    }));
  }

  const perBucket = useMemo(() => {
    if (raggruppamento === "settimana") {
      const nSettimane = Math.max(1, Math.ceil(giorniGrafico / 7));
      const arr = [];
      for (let w = nSettimane - 1; w >= 0; w--) {
        const fine = new Date(oggi); fine.setDate(fine.getDate() - w * 7);
        const inizio = new Date(fine); inizio.setDate(inizio.getDate() - 6);
        const inizioIso = inizio.toISOString().slice(0, 10);
        const fineIso = fine.toISOString().slice(0, 10);
        const bucketVendite = venditeFiltrate.filter((v) => v.data >= inizioIso && v.data <= fineIso);
        const segmenti = segmentiDi(bucketVendite);
        const tot = segmenti.reduce((s, seg) => s + seg.valore, 0);
        arr.push({ key: inizioIso, label: fmtDataBreve(inizioIso), title: `${fmtData(inizioIso)} – ${fmtData(fineIso)}`, totale: tot, segmenti });
      }
      return arr;
    }
    if (raggruppamento === "mese") {
      const mesi = [];
      for (let n = giorniGrafico - 1; n >= 0; n--) {
        const d = new Date(oggi); d.setDate(d.getDate() - n);
        const ym = d.toISOString().slice(0, 7);
        if (!mesi.includes(ym)) mesi.push(ym);
      }
      return mesi.map((ym: string) => {
        const bucketVendite = venditeFiltrate.filter((v) => v.data.slice(0, 7) === ym);
        const segmenti = segmentiDi(bucketVendite);
        const tot = segmenti.reduce((s, seg) => s + seg.valore, 0);
        const [y, m] = ym.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
        return { key: ym, label, title: label, totale: tot, segmenti };
      });
    }
    // giorno
    const arr = [];
    for (let n = giorniGrafico - 1; n >= 0; n--) {
      const d = new Date(oggi); d.setDate(d.getDate() - n);
      const iso = d.toISOString().slice(0, 10);
      const bucketVendite = venditeFiltrate.filter((v) => v.data === iso);
      const segmenti = segmentiDi(bucketVendite);
      const tot = segmenti.reduce((s, seg) => s + seg.valore, 0);
      arr.push({ key: iso, label: null, title: fmtData(iso), totale: tot, segmenti });
    }
    return arr;
  }, [venditeFiltrate, giorniGrafico, raggruppamento, sediPerSegmenti]);
  const maxBucket = Math.max(1, ...perBucket.map((g) => g.totale));

  // Pezzi e incasso (solo vendite completate) per articolo, con la
  // ripartizione per sede per colorare i segmenti della barra come nel
  // grafico Andamento. Si tengono entrambe le metriche già calcolate così
  // il toggle "pezzi/incasso" non deve ricalcolare nulla, solo riordinare.
  const [metricaArticoli, setMetricaArticoli] = useState<string>("pezzi");
  const topArticoliBase = useMemo(() => {
    const completate = venditePeriodoFiltrate.filter((v) => v.stato === "Completata");
    const perProdotto = new Map<string, Record<string, { pezzi: number; incasso: number }>>();
    completate.forEach((v) => {
      const key = v.prodotto || "—";
      if (!perProdotto.has(key)) perProdotto.set(key, {});
      const bucket = perProdotto.get(key);
      if (!bucket[v.strutturaId]) bucket[v.strutturaId] = { pezzi: 0, incasso: 0 };
      bucket[v.strutturaId].pezzi += Number(v.quantita) || 0;
      bucket[v.strutturaId].incasso += totaleVendita(v);
    });
    return Array.from(perProdotto.entries()).map(([prodotto, perSede]) => {
      const segmenti = sediPerSegmenti.map((s) => {
        const dati = perSede[s.id] || { pezzi: 0, incasso: 0 };
        return { id: s.id, nome: s.nome, colore: coloreSede(strutture, s.id), pezzi: dati.pezzi, incasso: dati.incasso };
      });
      return {
        prodotto, segmenti,
        totalePezzi: segmenti.reduce((s, seg) => s + seg.pezzi, 0),
        totaleIncasso: segmenti.reduce((s, seg) => s + seg.incasso, 0),
      };
    });
  }, [venditePeriodoFiltrate, sediPerSegmenti, strutture]);

  const campoArticoli = metricaArticoli === "incasso" ? "totaleIncasso" : "totalePezzi";
  const topArticoli = useMemo(() => {
    return topArticoliBase
      .filter((r) => r[campoArticoli] > 0)
      .sort((a, b) => b[campoArticoli] - a[campoArticoli])
      .slice(0, 8);
  }, [topArticoliBase, campoArticoli]);
  const maxArticolo = Math.max(1, ...topArticoli.map((a) => a[campoArticoli]));
  const fmtArticolo = (n) => (metricaArticoli === "incasso" ? fmtEuro(n) : `${n} pz`);

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl md:text-[28px] font-semibold text-stone-900">Cruscotto incassi</h1>
          <p className="text-stone-500 text-sm mt-1">Vending Machine · Gruppo Urban Homy</p>
        </div>
      </header>

      <div className="flex gap-2 mb-5">
        {PERIODI.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodo(p.id)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
              periodo === p.id ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Incasso totale" value={fmtEuro(stats.totaleIncasso)} sub={`${stats.nVendite} vendite completate`} icon={Euro} accent="bg-[#1F1A12]" />
        <StatCard label="Pezzi venduti" value={stats.totalePezzi} icon={Package} accent="bg-[#CA8A04]" />
        <StatCard label="Non erogate" value={stats.nNonErogate} sub="pagate ma non consegnate" icon={AlertTriangle} accent="bg-rose-500" />
        <StatCard label="Media per vendita" value={fmtEuro(stats.mediaPerVendita)} icon={Wallet} accent="bg-teal-600" />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-[Fraunces] font-semibold text-stone-900">Andamento ultimi {giorniGrafico} giorni</h2>
          <div className="flex gap-1.5">
            {[
              { id: "giorno", label: "Giorno" },
              { id: "settimana", label: "Settimana" },
              { id: "mese", label: "Mese" },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRaggruppamento(r.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                  raggruppamento === r.id ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {sediPerSegmenti.length > 1 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {sediPerSegmenti.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: coloreSede(strutture, s.id) }} />
                {s.nome}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1 h-32 overflow-x-auto">
          {perBucket.map((g) => {
            const segmentiValidi = g.segmenti.filter((seg) => seg.valore > 0);
            const tooltip = `${g.title} · ${fmtEuro(g.totale)}` + segmentiValidi.map((seg) => `\n${seg.nome}: ${fmtEuro(seg.valore)}`).join("");
            return (
              <div key={g.key} className="h-full flex-1 min-w-[8px] flex flex-col items-center justify-end gap-1.5 group relative">
                <div className="text-[10px] text-stone-400 opacity-0 group-hover:opacity-100 transition font-mono-tag whitespace-nowrap">{fmtEuro(g.totale)}</div>
                <div
                  className="w-full rounded-t shrink-0 overflow-hidden flex flex-col-reverse bg-stone-100"
                  style={{ height: `${Math.max(4, (g.totale / maxBucket) * 100)}%` }}
                  title={tooltip}
                >
                  {segmentiValidi.map((seg) => (
                    <div key={seg.id} style={{ height: `${(seg.valore / g.totale) * 100}%`, backgroundColor: seg.colore }} />
                  ))}
                </div>
                {g.label && <div className="text-[10px] text-stone-400 font-mono-tag whitespace-nowrap">{g.label}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-stone-400 mb-2">Clicca una sede per includerla o escluderla dai totali, dal grafico qui sopra e dagli articoli più venduti qui sotto.</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {strutture.map((s) => {
          const diSede = venditePeriodo.filter((v) => v.strutturaId === s.id);
          const completateSede = diSede.filter((v) => v.stato === "Completata");
          const tot = completateSede.reduce((sum, v) => sum + totaleVendita(v), 0);
          const selezionata = sediSelezionate.has(s.id);
          return (
            <button
              type="button" key={s.id} onClick={() => toggleSede(s.id)}
              className={`text-left bg-white border rounded-xl shadow-sm px-5 py-4 transition ${
                selezionata ? "border-[#CA8A04] ring-1 ring-[#CA8A04]" : "border-stone-200 opacity-50 hover:opacity-80"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-stone-400" />
                  <span className="font-semibold text-sm text-stone-900">{s.nome}</span>
                </div>
                <CheckCircle2 size={18} className={selezionata ? "text-[#CA8A04]" : "text-stone-300"} />
              </div>
              <div className="text-2xl font-bold text-stone-900 font-[Fraunces]">{fmtEuro(tot)}</div>
              <div className="text-xs text-stone-500 mt-1">{completateSede.length} vendite completate nel periodo selezionato</div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-[Fraunces] font-semibold text-stone-900">Articoli più venduti</h2>
          <div className="flex gap-1.5">
            {[
              { id: "pezzi", label: "Pezzi venduti" },
              { id: "incasso", label: "Importo incassato" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMetricaArticoli(m.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                  metricaArticoli === m.id ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-stone-400 mb-4">{metricaArticoli === "incasso" ? "Incasso" : "Pezzi venduti"} nel periodo selezionato, per sede</p>
        {topArticoli.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">Nessuna vendita completata nel periodo selezionato.</div>
        ) : (
          <div className="grid gap-3">
            {topArticoli.map((a) => {
              const valore = a[campoArticoli];
              const segmentiValidi = a.segmenti
                .map((seg) => ({ ...seg, valore: metricaArticoli === "incasso" ? seg.incasso : seg.pezzi }))
                .filter((seg) => seg.valore > 0);
              const tooltip = `${a.prodotto} · ${fmtArticolo(valore)}` + segmentiValidi.map((seg) => `\n${seg.nome}: ${fmtArticolo(seg.valore)}`).join("");
              return (
                <div key={a.prodotto}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm text-stone-800 truncate">{a.prodotto}</span>
                    <span className="text-sm font-semibold text-stone-900 font-mono-tag shrink-0">{fmtArticolo(valore)}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-stone-50">
                    <div
                      className="h-full rounded-full overflow-hidden flex"
                      style={{ width: `${(valore / maxArticolo) * 100}%` }}
                      title={tooltip}
                    >
                      {segmentiValidi.map((seg) => (
                        <div key={seg.id} style={{ width: `${(seg.valore / valore) * 100}%`, backgroundColor: seg.colore }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ELENCO VENDITE                                                       */
/* ------------------------------------------------------------------ */

function Vendite({ vendite, strutture, macchine, strutturaOf, macchinaOf, onApri, onImportaFile, importRisultato, onChiudiImport }: VenditeProps) {
  const [filtroStruttura, setFiltroStruttura] = useState<string>("");
  const [filtroMetodo, setFiltroMetodo] = useState<string>("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("tutto");
  const [ricerca, setRicerca] = useState<string>("");
  const [filtroStato, setFiltroStato] = useState<string>("");
  const [fileInAttesa, setFileInAttesa] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const elenco = vendite
    .filter((v) => !filtroStruttura || v.strutturaId === filtroStruttura)
    .filter((v) => !filtroMetodo || v.metodoPagamento === filtroMetodo)
    .filter((v) => !filtroStato || v.stato === filtroStato)
    .filter((v) => inPeriodo(v.data, filtroPeriodo))
    .filter((v) => !ricerca || v.prodotto.toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => (b.data + b.ora).localeCompare(a.data + a.ora));

  const completatePeriodo = elenco.filter((v) => v.stato === "Completata");
  const totalePeriodo = completatePeriodo.reduce((s, v) => s + totaleVendita(v), 0);
  const pezziPeriodo = completatePeriodo.reduce((s, v) => s + (Number(v.quantita) || 0), 0);

  function onFileScelto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setFileInAttesa(file);
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Vendite</h1>
          <p className="text-stone-500 text-sm mt-1">Vendite registrate dai distributori automatici</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileScelto} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importRisultato?.loading}
            className="flex items-center gap-2 bg-white border border-stone-300 hover:border-[#CA8A04] text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Upload size={16} /> {importRisultato?.loading ? "Importazione…" : "Importa da Excel"}
          </button>
        </div>
      </header>

      {importRisultato && !importRisultato.loading && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${importRisultato.errore ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-emerald-50 border-emerald-300 text-emerald-800"}`}>
          <div className="flex items-start gap-2.5">
            {importRisultato.errore ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <div className="flex-1">
              {importRisultato.errore ? (
                <div className="font-medium">{importRisultato.errore}</div>
              ) : (
                <>
                  <div className="font-medium">
                    {importRisultato.totaleImportati} vendite importate per {importRisultato.nomeSede}
                    {" "}({importRisultato.modalita === "sostituzione" ? "sostituite le vendite esistenti della sede" : "aggiunte alle vendite esistenti"})
                    {importRisultato.scartati?.length > 0 && `, ${importRisultato.scartati.length} righe scartate`}.
                  </div>
                  {importRisultato.scartati?.length > 0 && (
                    <ul className="mt-1.5 text-xs text-emerald-700/80 list-disc list-inside space-y-0.5">
                      {importRisultato.scartati.slice(0, 8).map((s, i) => (
                        <li key={i}>Riga {s.riga}: {s.motivo}</li>
                      ))}
                      {importRisultato.scartati.length > 8 && <li>…e altre {importRisultato.scartati.length - 8} righe.</li>}
                    </ul>
                  )}
                </>
              )}
            </div>
            <button onClick={onChiudiImport} className="text-current opacity-60 hover:opacity-100 shrink-0"><X size={15} /></button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatCard label="Incasso periodo" value={fmtEuro(totalePeriodo)} sub={`${completatePeriodo.length} completate`} icon={Euro} accent="bg-[#1F1A12]" />
        <StatCard label="Vendite" value={elenco.length} icon={ShoppingCart} accent="bg-[#CA8A04]" />
        <StatCard label="Pezzi venduti" value={pezziPeriodo} icon={Package} accent="bg-teal-600" />
      </div>

      <div className="flex flex-wrap gap-2 mb-5 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <Search size={15} className="text-stone-400 shrink-0" />
          <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per prodotto…" className="text-sm outline-none w-full bg-transparent" />
        </div>
        <select value={filtroStruttura} onChange={(e) => setFiltroStruttura(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutte le sedi</option>
          {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filtroMetodo} onChange={(e) => setFiltroMetodo(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti i pagamenti</option>
          {METODI_PAGAMENTO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti gli stati</option>
          {STATI_VENDITA.map((s) => <option key={s} value={s}>{STATI_VENDITA_LABEL[s]}</option>)}
        </select>
        <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className={inputCls + " w-auto text-xs"}>
          {PERIODI.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      {elenco.length === 0 ? (
        <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
          Nessuna vendita corrisponde ai filtri selezionati.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">Macchina</th>
                <th className="px-4 py-3">Prodotto</th>
                <th className="px-4 py-3 text-right">Quantità</th>
                <th className="px-4 py-3 text-right">Prezzo unitario</th>
                <th className="px-4 py-3 text-right">Totale</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {elenco.map((v) => {
                const MetodoIcon = metodoIcon[v.metodoPagamento];
                const StatoIcon = statoVenditaIcon[v.stato];
                return (
                  <tr key={v.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition cursor-pointer" onClick={() => onApri(v)}>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{fmtData(v.data)} · {v.ora}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{strutturaOf(v.strutturaId)?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{macchinaOf(v.macchinaId)?.nome ?? v.macchinaNome ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-900 font-medium">{v.prodotto}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{v.quantita}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{fmtEuro(v.prezzoUnitario)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900">{fmtEuro(totaleVendita(v))}</td>
                    <td className="px-4 py-3">
                      <Tag className="bg-stone-100 text-stone-600 border-transparent">
                        <MetodoIcon size={11} /> {v.metodoPagamento}
                      </Tag>
                    </td>
                    <td className="px-4 py-3">
                      <Tag className={statoVenditaColor[v.stato] + " border-transparent whitespace-nowrap"}>
                        <StatoIcon size={11} /> {STATI_VENDITA_LABEL[v.stato]}
                      </Tag>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); onApri(v); }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {fileInAttesa && (
        <ImportaVenditeForm
          strutture={strutture}
          onConferma={(strutturaId, modalita) => {
            onImportaFile(fileInAttesa, strutturaId, modalita);
            setFileInAttesa(null);
          }}
          onClose={() => setFileInAttesa(null)}
        />
      )}
    </div>
  );
}

function ImportaVenditeForm({ strutture, onConferma, onClose }: ImportaVenditeFormProps) {
  const [strutturaId, setStrutturaId] = useState<string>(strutture.find((s) => s.attiva)?.id ?? strutture[0]?.id ?? "");
  const [modalita, setModalita] = useState<string>("sostituzione");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!strutturaId) return;
    onConferma(strutturaId, modalita);
  }

  return (
    <Modal title="Importa vendite da Excel" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Per quale sede stai caricando queste vendite?">
          <select required className={inputCls} value={strutturaId} onChange={(e) => setStrutturaId(e.target.value)}>
            {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>

        <FieldGroup label="Modalità">
          <div className="grid gap-2">
            <button
              type="button" onClick={() => setModalita("sostituzione")}
              className={`text-left px-3 py-2.5 rounded-lg border transition ${
                modalita === "sostituzione" ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-700 border-stone-300"
              }`}
            >
              <div className="text-sm font-semibold">Sostituzione</div>
              <div className={`text-xs mt-0.5 ${modalita === "sostituzione" ? "text-stone-300" : "text-stone-500"}`}>
                Rimpiazza tutte le vendite già presenti per questa sede con quelle del file.
              </div>
            </button>
            <button
              type="button" onClick={() => setModalita("aggiunta")}
              className={`text-left px-3 py-2.5 rounded-lg border transition ${
                modalita === "aggiunta" ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-700 border-stone-300"
              }`}
            >
              <div className="text-sm font-semibold">Aggiunta</div>
              <div className={`text-xs mt-0.5 ${modalita === "aggiunta" ? "text-stone-300" : "text-stone-500"}`}>
                Accoda le vendite del file a quelle già presenti, senza toccarle.
              </div>
            </button>
          </div>
        </FieldGroup>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-stone-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
          <button type="submit" disabled={!strutturaId} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#CA8A04] hover:bg-[#AB7204] text-white disabled:opacity-50">Importa</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  FORM VENDITA                                                         */
/* ------------------------------------------------------------------ */

function VenditaForm({ esistente, strutture, macchine, onSalva, onElimina, onClose }: VenditaFormProps) {
  const [f, setF] = useState<VenditaFormFields>(esistente);
  function upd(patch) { setF((prev) => ({ ...prev, ...patch })); }

  const macchineSede = macchine.filter((m) => m.strutturaId === f.strutturaId);

  function onCambiaStruttura(strutturaId) {
    const ancoraValida = macchine.some((m) => m.id === f.macchinaId && m.strutturaId === strutturaId);
    upd({ strutturaId, macchinaId: ancoraValida ? f.macchinaId : "" });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.strutturaId || !f.data || !f.prodotto.trim()) return;
    onSalva({ ...f, quantita: Number(f.quantita) || 0, prezzoUnitario: Number(f.prezzoUnitario) || 0 });
  }

  return (
    <Modal title="Modifica vendita" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sede">
            <select className={inputCls} value={f.strutturaId} onChange={(e) => onCambiaStruttura(e.target.value)}>
              {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          <Field label="Macchina (opzionale)">
            <select className={inputCls} value={f.macchinaId} onChange={(e) => upd({ macchinaId: e.target.value })}>
              <option value="">—</option>
              {macchineSede.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input required type="date" className={inputCls} value={f.data} onChange={(e) => upd({ data: e.target.value })} />
          </Field>
          <Field label="Ora">
            <input type="time" className={inputCls} value={f.ora} onChange={(e) => upd({ ora: e.target.value })} />
          </Field>
        </div>

        <Field label="Prodotto">
          <input required className={inputCls} value={f.prodotto} onChange={(e) => upd({ prodotto: e.target.value })} placeholder="Es. Acqua naturale 50cl" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantità">
            <input required type="number" min="1" className={inputCls} value={f.quantita} onChange={(e) => upd({ quantita: e.target.value })} />
          </Field>
          <Field label="Prezzo unitario (€)">
            <input required type="number" min="0" step="0.01" className={inputCls} value={f.prezzoUnitario} onChange={(e) => upd({ prezzoUnitario: e.target.value })} placeholder="0.00" />
          </Field>
        </div>

        <Field label="Metodo di pagamento">
          <div className="flex gap-2">
            {METODI_PAGAMENTO.map((m) => {
              const Icon = metodoIcon[m];
              return (
                <button
                  type="button" key={m}
                  onClick={() => upd({ metodoPagamento: m })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border transition ${
                    f.metodoPagamento === m ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-500 border-stone-300"
                  }`}
                >
                  <Icon size={14} /> {m}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Stato">
          <div className="flex gap-2">
            {STATI_VENDITA.map((s) => {
              const Icon = statoVenditaIcon[s];
              return (
                <button
                  type="button" key={s}
                  onClick={() => upd({ stato: s })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition ${
                    f.stato === s ? "bg-[#1F1A12] text-white border-[#1F1A12]" : "bg-white text-stone-500 border-stone-300"
                  }`}
                >
                  <Icon size={13} /> {STATI_VENDITA_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
            <Trash2 size={15} /> Elimina
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#CA8A04] hover:bg-[#AB7204] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  SEDI                                                                 */
/* ------------------------------------------------------------------ */

function Sedi({ strutture, vendite, macchine, onNuova, onApri, onNuovaMacchina, onApriMacchina, onEliminaMacchina, onToggleMacchinaAttiva }: SediProps) {
  const sediCentrali: UHSede[] = UHAccounts.loadSedi();
  const sedeCentraleDi = (s: VendingStruttura): UHSede | null => sediCentrali.find((sc) => sc.id === s.sedeCentraleId) ?? null;
  const [espansa, setEspansa] = useState<Set<string>>(() => new Set());
  function toggleEspansa(id) {
    setEspansa((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Sedi</h1>
          <p className="text-stone-500 text-sm mt-1">Il servizio è attivo quando la sede ha almeno una macchina configurata e attiva</p>
        </div>
        <button onClick={onNuova} className="flex items-center gap-2 bg-[#CA8A04] hover:bg-[#AB7204] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuova sede
        </button>
      </header>

      <div className="grid gap-3">
        {strutture.map((s) => {
          const sedeCentrale = sedeCentraleDi(s);
          const nVendite = vendite.filter((v) => v.strutturaId === s.id).length;
          const macchineSede = macchine.filter((m) => m.strutturaId === s.id);
          const totaliTipo = macchineTotaliPerTipo(macchine, s.id);
          const aperta = espansa.has(s.id);
          const nome = sedeCentrale ? sedeCentrale.nome : s.nome;
          const citta = sedeCentrale ? sedeCentrale.citta : s.citta;
          // Il servizio è "attivo" se c'è almeno una macchina configurata e
          // attiva in questa sede, non in base a un flag della sede stessa.
          const attiva = macchineSede.some((m) => m.attiva !== false);
          return (
            <div key={s.id} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <button onClick={() => toggleEspansa(s.id)} className="w-10 h-10 rounded-lg bg-[#1F1A12] flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-white" />
                </button>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleEspansa(s.id)}>
                  <div className="font-semibold text-sm text-stone-900 flex items-center gap-1.5 flex-wrap">
                    {nome}
                    {!sedeCentrale && (
                      <Tag className="bg-amber-50 text-amber-700 border-amber-300">Da collegare a una sede centrale</Tag>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {citta} · {nVendite} vendite registrate · {macchineSede.length} macchin{macchineSede.length === 1 ? "a censita" : "e censite"}
                  </div>
                </div>
                <Tag className={attiva ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-stone-50 text-stone-500 border-stone-300"}>
                  {attiva ? "Servizio attivo" : "In arrivo"}
                </Tag>
                <button onClick={() => onApri(s)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0">
                  <Pencil size={15} />
                </button>
                <button onClick={() => toggleEspansa(s.id)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0">
                  <ChevronDown size={16} className={`transition-transform ${aperta ? "rotate-180" : ""}`} />
                </button>
              </div>

              {aperta && (
                <div className="border-t border-stone-200 bg-stone-50/60 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-2">
                      {TIPI_MACCHINA.map((t) => (
                        <Tag key={t} className="bg-white text-stone-700 border-stone-300">
                          {t}: <span className="font-semibold">{totaliTipo[t]}</span>
                        </Tag>
                      ))}
                    </div>
                    <button onClick={() => onNuovaMacchina(s.id)} className="flex items-center gap-1.5 text-xs font-semibold text-[#CA8A04] hover:text-[#AB7204]">
                      <Plus size={14} /> Aggiungi macchina
                    </button>
                  </div>

                  {macchineSede.length === 0 ? (
                    <div className="text-center py-6 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-lg">
                      Nessuna macchina censita per questa sede.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {macchineSede.map((m) => {
                        const macchinaAttiva = m.attiva !== false;
                        return (
                          <div key={m.id} className="bg-white border border-stone-200 rounded-lg px-4 py-3 flex items-center gap-3">
                            <ShoppingCart size={16} className="text-stone-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-stone-900">{m.nome}</div>
                              <div className="text-xs text-stone-500 mt-0.5">{m.tipo}</div>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-medium text-stone-700 cursor-pointer shrink-0">
                              <input type="checkbox" className="accent-[#CA8A04]" checked={macchinaAttiva} onChange={() => onToggleMacchinaAttiva(m.id)} />
                              {macchinaAttiva ? "Attiva" : "Non attiva"}
                            </label>
                            <button onClick={() => onApriMacchina(m)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => onEliminaMacchina(m.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StrutturaForm({ esistente, onSalva, onElimina, onClose }: StrutturaFormProps) {
  const sediCentrali: UHSede[] = UHAccounts.loadSedi();
  const vuoto: StrutturaFormState = { id: null, sedeCentraleId: "" };
  const [f, setF] = useState<StrutturaFormState>(esistente ? { id: esistente.id, sedeCentraleId: esistente.sedeCentraleId || "" } : vuoto);
  function upd(patch) { setF((prev) => ({ ...prev, ...patch })); }

  const sedeScelta: UHSede | null = sediCentrali.find((s) => s.id === f.sedeCentraleId) ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sedeScelta) return;
    onSalva({ id: f.id ?? "", sedeCentraleId: sedeScelta.id, nome: sedeScelta.nome, citta: sedeScelta.citta ?? "", attiva: sedeScelta.attiva });
  }

  return (
    <Modal title={esistente ? "Modifica sede" : "Nuova sede"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Sede centrale">
          <select required className={inputCls} value={f.sedeCentraleId} onChange={(e) => upd({ sedeCentraleId: e.target.value })}>
            <option value="">Seleziona sede…</option>
            {sediCentrali.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.citta ? ` — ${s.citta}` : ""}</option>)}
          </select>
          <span className="text-xs text-stone-400 mt-1.5 block">
            Le sedi si gestiscono centralmente nell'app "Utenti e accessi" (Impostazioni → Sedi).
          </span>
        </Field>

        {sedeScelta && (
          <div className="border border-stone-200 rounded-lg px-3.5 py-2.5 mb-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-stone-800">{sedeScelta.nome}</span>
              <Tag className="bg-stone-50 text-stone-500 border-stone-300">{sedeScelta.tipo}</Tag>
              <Tag className={sedeScelta.attiva ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-stone-50 text-stone-500 border-stone-300"}>
                {sedeScelta.attiva ? "Attiva" : "Non attiva"}
              </Tag>
            </div>
            {(sedeScelta.citta || sedeScelta.indirizzo) && (
              <div className="text-xs text-stone-500 mt-1">{[sedeScelta.indirizzo, sedeScelta.citta].filter(Boolean).join(", ")}</div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#CA8A04] hover:bg-[#AB7204] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function MacchinaForm({ esistente, prefill, strutture, onSalva, onElimina, onClose }: MacchinaFormProps) {
  const vuoto: MacchinaFormState = {
    id: null, strutturaId: prefill?.strutturaId || strutture[0]?.id || "", nome: "", tipo: TIPI_MACCHINA[0], attiva: true,
  };
  const [f, setF] = useState<MacchinaFormState>(esistente ? { ...esistente } : vuoto);
  function upd(patch) { setF((prev) => ({ ...prev, ...patch })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.strutturaId) return;
    onSalva({ ...f, id: f.id ?? "" });
  }

  return (
    <Modal title={esistente ? "Modifica macchina" : "Nuova macchina"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sede">
            <select className={inputCls} value={f.strutturaId} onChange={(e) => upd({ strutturaId: e.target.value })}>
              {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          <Field label="Tipo macchina">
            <select className={inputCls} value={f.tipo} onChange={(e) => upd({ tipo: e.target.value })}>
              {TIPI_MACCHINA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Nome macchina">
          <input required className={inputCls} value={f.nome} onChange={(e) => upd({ nome: e.target.value })} placeholder="Es. Distributore reception, Piano bar…" />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 cursor-pointer mb-1">
          <input type="checkbox" className="accent-[#CA8A04]" checked={f.attiva !== false} onChange={(e) => upd({ attiva: e.target.checked })} />
          Macchina attiva
        </label>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#CA8A04] hover:bg-[#AB7204] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
