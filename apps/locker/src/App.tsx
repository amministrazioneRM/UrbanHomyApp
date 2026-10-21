import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Luggage, LayoutGrid, Wallet, Plus, Pencil, Trash2, X, ArrowLeft,
  Settings, MapPin, Package, TrendingUp, Euro, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  CheckCircle2, Ban, Search, Globe, Monitor, Upload, AlertTriangle,
  DoorClosed, ChevronRight, ShoppingCart
} from "lucide-react";
// @ts-ignore
import * as XLSX from "xlsx";
import UHAccounts from "./accounts";
import { api, useSyncedResource, useBackendOffline } from "./api";

const APP_ID = "baggyLocker";

let _id = 1000;
const nid = (p: string): string => `${p}-${_id++}`;

/* ------------------------------------------------------------------ */
/*  DOMAIN INTERFACES                                                    */
/* ------------------------------------------------------------------ */

interface LockerStruttura { id: string; sedeCentraleId: string; nome: string; citta: string; attiva: boolean }
interface LockerOrdine { id: string; strutturaId: string; dataOrdine: string; oraOrdine: string; inizio: string; oraInizio: string; fine: string; oraFine: string; prezzo: number; stato: string; numArmadio: number; tipologia: string; provenienza: string }
interface LockerLocale { id: string; strutturaId: string; nome: string; conteggi: Record<string, number> }
interface VendingStruttura { id: string; sedeCentraleId: string; nome: string; citta: string; attiva: boolean }
interface VendingVendita { id: string; strutturaId: string; macchinaId?: string; macchinaNome?: string; data: string; ora: string; prodotto: string; quantita: number; prezzoUnitario: number; metodoPagamento: string; stato: string }

type ModaleState =
  | { type: "nuovoOrdine"; payload: null }
  | { type: "modificaOrdine"; payload: LockerOrdine }
  | { type: "nuovaSede"; payload: null }
  | { type: "modificaSede"; payload: LockerStruttura }
  | { type: "nuovoLocale"; payload: null; prefill: { strutturaId: string } }
  | { type: "modificaLocale"; payload: LockerLocale };

interface ImportRisultato {
  loading: boolean;
  errore?: string;
  refresh?: boolean;
  totaleImportati?: number;
  nomeSede?: string;
  modalita?: string;
  scartati?: Array<{ riga: number; motivo: string }>;
}

interface Segmento { id: string; nome: string; colore: string; valore: number }
interface Bucket { key: string; label: string | null; title: string; totale: number; segmenti: Segmento[] }
interface TopTipologia {
  tipologia: string;
  segmenti: Array<{ id: string; nome: string; colore: string; pezzi: number; incasso: number }>;
  totalePezzi: number;
  totaleIncasso: number;
}

/* ------------------------------------------------------------------ */
/*  SEED DATA                                                            */
/* ------------------------------------------------------------------ */

const seedStrutture: LockerStruttura[] = [
  { id: "LOC-1", sedeCentraleId: "SEDE-6", nome: "Baggy Locker Padova", citta: "Padova", attiva: true },
  { id: "LOC-2", sedeCentraleId: "SEDE-7", nome: "Baggy Locker Trieste", citta: "Trieste", attiva: false },
];

const seedOrdini: LockerOrdine[] = [
  { id: "BJduOQ26", strutturaId: "LOC-1", dataOrdine: "2026-08-13", oraOrdine: "12:30", inizio: "2026-08-13", oraInizio: "12:30", fine: "2026-08-13", oraFine: "14:30", prezzo: 6.95, stato: "Concluso", numArmadio: 48, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "OqvSqa26", strutturaId: "LOC-1", dataOrdine: "2026-08-13", oraOrdine: "11:01", inizio: "2026-08-13", oraInizio: "11:01", fine: "2026-08-13", oraFine: "16:01", prezzo: 15.49, stato: "Concluso", numArmadio: 47, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "MkEUID26", strutturaId: "LOC-1", dataOrdine: "2026-08-13", oraOrdine: "10:57", inizio: "2026-08-13", oraInizio: "10:57", fine: "2026-08-13", oraFine: "12:57", prezzo: 5.45, stato: "Concluso", numArmadio: 1, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "ix4nAy26", strutturaId: "LOC-1", dataOrdine: "2026-08-12", oraOrdine: "13:52", inizio: "2026-08-12", oraInizio: "13:52", fine: "2026-08-12", oraFine: "15:52", prezzo: 5.45, stato: "Concluso", numArmadio: 25, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "DQIGLP26", strutturaId: "LOC-1", dataOrdine: "2026-08-12", oraOrdine: "12:32", inizio: "2026-08-12", oraInizio: "12:32", fine: "2026-08-12", oraFine: "15:32", prezzo: 9.98, stato: "Concluso", numArmadio: 46, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "JVZytP26", strutturaId: "LOC-1", dataOrdine: "2026-08-11", oraOrdine: "12:38", inizio: "2026-08-11", oraInizio: "12:38", fine: "2026-08-11", oraFine: "21:38", prezzo: 24.39, stato: "Concluso", numArmadio: 45, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "KCGtDt26", strutturaId: "LOC-1", dataOrdine: "2026-08-11", oraOrdine: "10:52", inizio: "2026-08-11", oraInizio: "10:52", fine: "2026-08-11", oraFine: "15:52", prezzo: 12.39, stato: "Concluso", numArmadio: 44, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "4nN4N826", strutturaId: "LOC-1", dataOrdine: "2026-08-10", oraOrdine: "13:36", inizio: "2026-08-10", oraInizio: "13:36", fine: "2026-08-10", oraFine: "18:36", prezzo: 10.99, stato: "Concluso", numArmadio: 24, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "euZu3C26", strutturaId: "LOC-1", dataOrdine: "2026-08-10", oraOrdine: "13:31", inizio: "2026-08-10", oraInizio: "13:31", fine: "2026-08-10", oraFine: "18:31", prezzo: 15.49, stato: "Concluso", numArmadio: 43, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "XTBBKC26", strutturaId: "LOC-1", dataOrdine: "2026-08-09", oraOrdine: "11:24", inizio: "2026-08-09", oraInizio: "11:24", fine: "2026-08-09", oraFine: "20:24", prezzo: 17.89, stato: "Concluso", numArmadio: 23, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "t17JAJ26", strutturaId: "LOC-1", dataOrdine: "2026-08-08", oraOrdine: "10:02", inizio: "2026-08-08", oraInizio: "10:02", fine: "2026-08-08", oraFine: "14:02", prezzo: 7.11, stato: "Concluso", numArmadio: 22, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "2fIdyn26", strutturaId: "LOC-1", dataOrdine: "2026-08-07", oraOrdine: "11:16", inizio: "2026-08-07", oraInizio: "11:16", fine: "2026-08-07", oraFine: "13:16", prezzo: 5.45, stato: "Concluso", numArmadio: 21, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "idvkR126", strutturaId: "LOC-1", dataOrdine: "2026-08-07", oraOrdine: "11:13", inizio: "2026-08-07", oraInizio: "11:13", fine: "2026-08-07", oraFine: "13:13", prezzo: 5.56, stato: "Concluso", numArmadio: 42, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "3GLgxz26", strutturaId: "LOC-1", dataOrdine: "2026-08-07", oraOrdine: "09:45", inizio: "2026-08-07", oraInizio: "09:45", fine: "2026-08-07", oraFine: "12:45", prezzo: 7.98, stato: "Concluso", numArmadio: 41, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "QccvaV26", strutturaId: "LOC-1", dataOrdine: "2026-08-06", oraOrdine: "16:25", inizio: "2026-08-19", oraInizio: "09:20", fine: "2026-08-19", oraFine: "12:20", prezzo: 9.98, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Medio - Medium Box", provenienza: "Web" },
  { id: "yeDv0G26", strutturaId: "LOC-1", dataOrdine: "2026-08-06", oraOrdine: "16:24", inizio: "2026-08-19", oraInizio: "09:20", fine: "2026-08-19", oraFine: "12:20", prezzo: 9.98, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Medio - Medium Box", provenienza: "Web" },
  { id: "KnRu7M26", strutturaId: "LOC-1", dataOrdine: "2026-08-06", oraOrdine: "14:28", inizio: "2026-08-06", oraInizio: "14:28", fine: "2026-08-06", oraFine: "15:28", prezzo: 3.47, stato: "Concluso", numArmadio: 40, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "mX7bwP26", strutturaId: "LOC-1", dataOrdine: "2026-08-06", oraOrdine: "13:42", inizio: "2026-08-06", oraInizio: "13:42", fine: "2026-08-06", oraFine: "19:42", prezzo: 18.49, stato: "Concluso", numArmadio: 39, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "mXKTIz26", strutturaId: "LOC-1", dataOrdine: "2026-08-05", oraOrdine: "11:45", inizio: "2026-08-05", oraInizio: "11:45", fine: "2026-08-05", oraFine: "15:45", prezzo: 12.99, stato: "Concluso", numArmadio: 38, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "KcPb7r26", strutturaId: "LOC-1", dataOrdine: "2026-08-01", oraOrdine: "10:14", inizio: "2026-08-01", oraInizio: "10:14", fine: "2026-08-01", oraFine: "13:14", prezzo: 7.98, stato: "Concluso", numArmadio: 37, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "rkxrFG26", strutturaId: "LOC-1", dataOrdine: "2026-08-01", oraOrdine: "09:06", inizio: "2026-08-01", oraInizio: "09:06", fine: "2026-08-02", oraFine: "09:06", prezzo: 25.99, stato: "Concluso", numArmadio: 36, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "645MQM26", strutturaId: "LOC-1", dataOrdine: "2026-07-31", oraOrdine: "12:12", inizio: "2026-07-31", oraInizio: "12:12", fine: "2026-07-31", oraFine: "18:12", prezzo: 12.49, stato: "Concluso", numArmadio: 20, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "IVDnSV26", strutturaId: "LOC-1", dataOrdine: "2026-07-31", oraOrdine: "11:19", inizio: "2026-07-31", oraInizio: "11:19", fine: "2026-07-31", oraFine: "20:19", prezzo: 19.51, stato: "Concluso", numArmadio: 35, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "p5inEH26", strutturaId: "LOC-1", dataOrdine: "2026-07-30", oraOrdine: "16:39", inizio: "2026-07-30", oraInizio: "16:39", fine: "2026-07-30", oraFine: "18:39", prezzo: 5.45, stato: "Concluso", numArmadio: 19, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "ynELgu26", strutturaId: "LOC-1", dataOrdine: "2026-07-30", oraOrdine: "11:02", inizio: "2026-07-30", oraInizio: "11:02", fine: "2026-07-30", oraFine: "15:02", prezzo: 7.11, stato: "Concluso", numArmadio: 18, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "w3LjdR26", strutturaId: "LOC-1", dataOrdine: "2026-07-30", oraOrdine: "10:49", inizio: "2026-07-30", oraInizio: "10:49", fine: "2026-07-30", oraFine: "13:49", prezzo: 7.98, stato: "Concluso", numArmadio: 34, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "i4JIej26", strutturaId: "LOC-1", dataOrdine: "2026-07-28", oraOrdine: "10:17", inizio: "2026-07-28", oraInizio: "10:17", fine: "2026-07-28", oraFine: "15:17", prezzo: 8.79, stato: "Concluso", numArmadio: 17, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "BwDb3M26", strutturaId: "LOC-1", dataOrdine: "2026-07-27", oraOrdine: "10:24", inizio: "2026-07-27", oraInizio: "10:24", fine: "2026-07-27", oraFine: "14:24", prezzo: 8.89, stato: "Concluso", numArmadio: 16, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "Lfl3G426", strutturaId: "LOC-1", dataOrdine: "2026-07-27", oraOrdine: "10:14", inizio: "2026-07-27", oraInizio: "10:14", fine: "2026-07-27", oraFine: "14:14", prezzo: 8.89, stato: "Concluso", numArmadio: 15, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "8GUaOI26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "12:20", inizio: "2026-07-26", oraInizio: "12:20", fine: "2026-07-26", oraFine: "15:20", prezzo: 6.89, stato: "Concluso", numArmadio: 14, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "cohwgz26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "12:17", inizio: "2026-07-26", oraInizio: "12:17", fine: "2026-07-26", oraFine: "15:17", prezzo: 9.98, stato: "Concluso", numArmadio: 33, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "lRzuiv26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "11:26", inizio: "2026-07-26", oraInizio: "11:26", fine: "2026-07-26", oraFine: "14:26", prezzo: 9.98, stato: "Concluso", numArmadio: 32, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "OjB2sm26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "11:24", inizio: "2026-07-26", oraInizio: "11:30", fine: "2026-07-26", oraFine: "14:30", prezzo: 9.98, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Medio - Medium Box", provenienza: "Web" },
  { id: "QQbLHK26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "11:23", inizio: "2026-07-26", oraInizio: "11:30", fine: "2026-07-26", oraFine: "14:30", prezzo: 9.98, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Medio - Medium Box", provenienza: "Web" },
  { id: "7XSau926", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "11:23", inizio: "2026-07-26", oraInizio: "11:30", fine: "2026-07-26", oraFine: "14:30", prezzo: 9.98, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Medio - Medium Box", provenienza: "Web" },
  { id: "9ECsTx26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "10:22", inizio: "2026-07-26", oraInizio: "10:22", fine: "2026-07-26", oraFine: "15:22", prezzo: 10.99, stato: "Concluso", numArmadio: 13, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "6qLA8V26", strutturaId: "LOC-1", dataOrdine: "2026-07-26", oraOrdine: "10:19", inizio: "2026-07-26", oraInizio: "10:19", fine: "2026-07-26", oraFine: "15:19", prezzo: 15.49, stato: "Concluso", numArmadio: 31, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "nHTkmZ26", strutturaId: "LOC-1", dataOrdine: "2026-07-25", oraOrdine: "11:53", inizio: "2026-07-25", oraInizio: "11:53", fine: "2026-07-25", oraFine: "13:53", prezzo: 5.56, stato: "Concluso", numArmadio: 30, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "e8elUI26", strutturaId: "LOC-1", dataOrdine: "2026-07-24", oraOrdine: "14:18", inizio: "2026-07-24", oraInizio: "14:18", fine: "2026-07-24", oraFine: "18:18", prezzo: 12.99, stato: "Concluso", numArmadio: 29, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "3Tftsm26", strutturaId: "LOC-1", dataOrdine: "2026-07-24", oraOrdine: "11:39", inizio: "2026-07-24", oraInizio: "11:39", fine: "2026-07-24", oraFine: "18:39", prezzo: 13.97, stato: "Concluso", numArmadio: 12, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "ldyEgH26", strutturaId: "LOC-1", dataOrdine: "2026-07-24", oraOrdine: "11:36", inizio: "2026-07-24", oraInizio: "11:36", fine: "2026-07-24", oraFine: "14:36", prezzo: 6.89, stato: "Concluso", numArmadio: 11, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "hXnbUP26", strutturaId: "LOC-1", dataOrdine: "2026-07-23", oraOrdine: "13:06", inizio: "2026-07-23", oraInizio: "13:06", fine: "2026-07-23", oraFine: "19:06", prezzo: 12.49, stato: "Concluso", numArmadio: 10, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "WOIc6226", strutturaId: "LOC-1", dataOrdine: "2026-07-22", oraOrdine: "13:42", inizio: "2026-07-22", oraInizio: "13:42", fine: "2026-07-22", oraFine: "21:42", prezzo: 22.89, stato: "Concluso", numArmadio: 28, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "JhmZdE26", strutturaId: "LOC-1", dataOrdine: "2026-07-22", oraOrdine: "13:17", inizio: "2026-07-22", oraInizio: "13:17", fine: "2026-07-22", oraFine: "15:17", prezzo: 5.45, stato: "Concluso", numArmadio: 9, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "dV27Oe26", strutturaId: "LOC-1", dataOrdine: "2026-07-22", oraOrdine: "10:21", inizio: "2026-07-22", oraInizio: "10:21", fine: "2026-07-22", oraFine: "16:21", prezzo: 12.49, stato: "Concluso", numArmadio: 8, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "Prf0in26", strutturaId: "LOC-1", dataOrdine: "2026-07-09", oraOrdine: "11:14", inizio: "2026-07-09", oraInizio: "11:14", fine: "2026-07-09", oraFine: "12:14", prezzo: 2.72, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "i9thXM26", strutturaId: "LOC-1", dataOrdine: "2026-07-09", oraOrdine: "07:30", inizio: "2026-07-09", oraInizio: "07:30", fine: "2026-07-09", oraFine: "13:30", prezzo: 18.49, stato: "Annullato", numArmadio: 0, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "A1Qshb26", strutturaId: "LOC-1", dataOrdine: "2026-07-08", oraOrdine: "12:21", inizio: "2026-07-08", oraInizio: "12:21", fine: "2026-07-08", oraFine: "16:21", prezzo: 8.89, stato: "Concluso", numArmadio: 7, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "zhCULT26", strutturaId: "LOC-1", dataOrdine: "2026-07-06", oraOrdine: "10:17", inizio: "2026-07-06", oraInizio: "10:17", fine: "2026-07-06", oraFine: "13:17", prezzo: 9.98, stato: "Concluso", numArmadio: 27, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "sMHhhN26", strutturaId: "LOC-1", dataOrdine: "2026-07-02", oraOrdine: "12:33", inizio: "2026-07-02", oraInizio: "12:30", fine: "2026-07-02", oraFine: "13:30", prezzo: 2.72, stato: "Concluso", numArmadio: 6, tipologia: "Box Piccolo - Small Box", provenienza: "Web" },
  { id: "dpnfSR26", strutturaId: "LOC-1", dataOrdine: "2026-07-02", oraOrdine: "12:29", inizio: "2026-07-02", oraInizio: "12:30", fine: "2026-07-02", oraFine: "13:30", prezzo: 2.72, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Piccolo - Small Box", provenienza: "Web" },
  { id: "PQOwcA26", strutturaId: "LOC-1", dataOrdine: "2026-07-02", oraOrdine: "12:29", inizio: "2026-07-02", oraInizio: "12:30", fine: "2026-07-02", oraFine: "13:30", prezzo: 2.72, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Piccolo - Small Box", provenienza: "Web" },
  { id: "9yqias26", strutturaId: "LOC-1", dataOrdine: "2026-07-02", oraOrdine: "12:29", inizio: "2026-07-02", oraInizio: "12:30", fine: "2026-07-02", oraFine: "13:30", prezzo: 2.72, stato: "InAttesaDiPagamento", numArmadio: 0, tipologia: "Box Piccolo - Small Box", provenienza: "Web" },
  { id: "APzXQc26", strutturaId: "LOC-1", dataOrdine: "2026-06-30", oraOrdine: "17:02", inizio: "2026-06-30", oraInizio: "17:02", fine: "2026-06-30", oraFine: "20:02", prezzo: 6.89, stato: "Concluso", numArmadio: 5, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "rFCA7U26", strutturaId: "LOC-1", dataOrdine: "2026-05-27", oraOrdine: "08:47", inizio: "2026-05-27", oraInizio: "08:47", fine: "2026-05-27", oraFine: "09:47", prezzo: 0.02, stato: "Concluso", numArmadio: 26, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
  { id: "nbhXtJ26", strutturaId: "LOC-1", dataOrdine: "2026-05-27", oraOrdine: "08:35", inizio: "2026-05-27", oraInizio: "08:35", fine: "2026-05-27", oraFine: "09:35", prezzo: 0.02, stato: "Concluso", numArmadio: 4, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "6lmgyH26", strutturaId: "LOC-1", dataOrdine: "2026-05-26", oraOrdine: "13:22", inizio: "2026-05-26", oraInizio: "13:22", fine: "2026-05-26", oraFine: "14:22", prezzo: 0.02, stato: "Concluso", numArmadio: 3, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "RGJIMd26", strutturaId: "LOC-1", dataOrdine: "2026-05-26", oraOrdine: "13:18", inizio: "2026-05-26", oraInizio: "13:18", fine: "2026-05-26", oraFine: "14:18", prezzo: 0.02, stato: "Concluso", numArmadio: 2, tipologia: "Box Piccolo - Small Box", provenienza: "Totem" },
  { id: "WVyCQ126", strutturaId: "LOC-1", dataOrdine: "2026-05-26", oraOrdine: "13:17", inizio: "2026-05-26", oraInizio: "13:17", fine: "2026-05-26", oraFine: "14:17", prezzo: 0.02, stato: "Concluso", numArmadio: 1, tipologia: "Box Medio - Medium Box", provenienza: "Totem" },
];

const seedLocali: LockerLocale[] = [];

/* ------------------------------------------------------------------ */
/*  COSTANTI                                                             */
/* ------------------------------------------------------------------ */

const oggi = new Date();

const STATI = ["Concluso", "InAttesaDiPagamento", "Annullato"];
const STATI_LABEL: Record<string, string> = { Concluso: "Concluso", InAttesaDiPagamento: "In attesa di pagamento", Annullato: "Annullato" };
const statoColor: Record<string, string> = {
  Concluso: "bg-emerald-600 text-white",
  InAttesaDiPagamento: "bg-amber-500 text-white",
  Annullato: "bg-stone-300 text-stone-600",
};
const statoIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Concluso: CheckCircle2, InAttesaDiPagamento: Clock3, Annullato: Ban,
};

const TIPOLOGIE = ["Box Piccolo - Small Box", "Box Medio - Medium Box", "Box Grande - Large Box"];
const PROVENIENZE = ["Totem", "Web"];
const provenienzaIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = { Totem: Monitor, Web: Globe };

const PERIODI: Array<{ id: string; label: string }> = [
  { id: "sett-corrente", label: "Settimana corrente" },
  { id: "sett-prec", label: "Settimana precedente" },
  { id: "mese-corrente", label: "Mese corrente" },
  { id: "mese-prec", label: "Mese precedente" },
  { id: "anno-corrente", label: "Anno corrente" },
  { id: "anno-prec", label: "Anno precedente" },
  { id: "tutto", label: "Tutto" },
];

function incassato(o: LockerOrdine): number { return o.stato === "Concluso" ? o.prezzo : 0; }
function inAttesa(o: LockerOrdine): number { return o.stato === "InAttesaDiPagamento" ? o.prezzo : 0; }
function durataOre(o: LockerOrdine): number {
  const ini = new Date(o.inizio + "T" + o.oraInizio);
  const fin = new Date(o.fine + "T" + o.oraFine);
  return Math.max(0, (fin.getTime() - ini.getTime()) / 3600000);
}
function fmtEuro(n: number): string { return "â‚¬ " + (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtData(iso: string | undefined): string {
  if (!iso) return "â€”";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDataBreve(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}
function inPeriodo(iso: string, periodoId: string): boolean {
  if (periodoId === "tutto") return true;
  const now = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth();
  const lunedi = new Date(now);
  lunedi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  let da: Date, a: Date;
  switch (periodoId) {
    case "sett-corrente": da = lunedi; a = now; break;
    case "sett-prec": {
      const lp = new Date(lunedi); lp.setDate(lunedi.getDate() - 7);
      const dp = new Date(lunedi); dp.setDate(lunedi.getDate() - 1);
      da = lp; a = dp; break;
    }
    case "mese-corrente": da = new Date(anno, mese, 1); a = now; break;
    case "mese-prec": da = new Date(anno, mese - 1, 1); a = new Date(anno, mese, 0); break;
    case "anno-corrente": da = new Date(anno, 0, 1); a = now; break;
    case "anno-prec": da = new Date(anno - 1, 0, 1); a = new Date(anno - 1, 11, 31); break;
    default: return true;
  }
  const s = da.toISOString().slice(0, 10);
  const e = a.toISOString().slice(0, 10);
  return iso >= s && iso <= e;
}

const PALETTE_SEDI: string[] = ["#1E8E6E", "#0EA5E9", "#DC2626", "#CA8A04", "#7C3AED", "#DB2777", "#EA580C", "#0D9488"];
function coloreSede(strutture: LockerStruttura[], strutturaId: string): string {
  const idx = strutture.findIndex((s) => s.id === strutturaId);
  return PALETTE_SEDI[idx < 0 ? 0 : idx % PALETTE_SEDI.length];
}

function localiTotaliPerTipo(locali: LockerLocale[], strutturaId: string): Record<string, number> {
  const totali: Record<string, number> = {};
  TIPOLOGIE.forEach((t) => { totali[t] = 0; });
  locali.filter((l) => l.strutturaId === strutturaId).forEach((l) => {
    TIPOLOGIE.forEach((t) => { totali[t] += Number(l.conteggi?.[t]) || 0; });
  });
  return totali;
}
function totaleLocker(conteggi: Record<string, number> | undefined): number {
  return TIPOLOGIE.reduce((s, t) => s + (Number(conteggi?.[t]) || 0), 0);
}

function totaleVendita(v: VendingVendita): number { return (Number(v.prezzoUnitario) || 0) * (Number(v.quantita) || 0); }

/* ------------------------------------------------------------------ */
/*  IMPORT ORDINI DA EXCEL                                              */
/* ------------------------------------------------------------------ */

const STATO_ALIAS: Record<string, string> = {
  "concluso": "Concluso", "completato": "Concluso", "completed": "Concluso", "chiuso": "Concluso", "pagato": "Concluso",
  "in attesa di pagamento": "InAttesaDiPagamento", "in attesa": "InAttesaDiPagamento", "pending": "InAttesaDiPagamento",
  "da pagare": "InAttesaDiPagamento", "non pagato": "InAttesaDiPagamento",
  "annullato": "Annullato", "cancellato": "Annullato", "cancelled": "Annullato", "canceled": "Annullato", "rimborsato": "Annullato",
};
const PROVENIENZA_ALIAS: Record<string, string> = {
  "totem": "Totem", "kiosk": "Totem", "chiosco": "Totem", "colonnina": "Totem",
  "web": "Web", "sito": "Web", "online": "Web", "app": "Web", "sito web": "Web",
};
const CAMPI_ALIAS: Record<string, string[]> = {
  id: ["codice ordine", "codice", "id", "order id", "ordine", "booking id", "id ordine", "codice prenotazione"],
  strutturaNome: ["sede", "struttura", "location", "site", "negozio", "punto vendita"],
  dataOrdine: ["data ordine", "data", "order date", "data creazione", "data acquisto"],
  oraOrdine: ["ora ordine", "ora", "order time", "ora creazione", "ora acquisto"],
  inizio: ["inizio", "inizio noleggio", "data inizio", "check in", "checkin", "start date", "data noleggio", "data deposito"],
  oraInizio: ["ora inizio", "ora inizio noleggio", "ora check in", "start time", "ora deposito"],
  fine: ["fine", "fine noleggio", "data fine", "check out", "checkout", "end date", "data ritiro"],
  oraFine: ["ora fine", "ora fine noleggio", "ora check out", "end time", "ora ritiro"],
  prezzo: ["prezzo", "importo", "totale", "price", "amount", "totale eur", "prezzo eur", "incasso"],
  stato: ["stato", "status"],
  numArmadio: ["armadio", "n armadio", "numero armadio", "locker", "locker number", "box", "n box"],
  tipologia: ["tipologia", "tipologia armadio", "tipologia box", "tipo", "tipo armadio", "tipo box", "box type", "categoria", "taglia"],
  provenienza: ["provenienza", "canale", "source", "channel"],
};

const DIACRITICI_RE = new RegExp("[\\u0300-\\u036f]", "g");
function normalizeTesto(v: unknown): string {
  return String(v ?? "").toLowerCase().normalize("NFD").replace(DIACRITICI_RE, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function trovaCampo(rigaNorm: Record<string, unknown>, chiavi: string[]): unknown {
  for (const k of chiavi) {
    if (rigaNorm[k] !== undefined && rigaNorm[k] !== "") return rigaNorm[k];
  }
  return undefined;
}
// Alcuni export (es. "DataGrid.xlsx" del gestionale locker) dichiarano nel
// foglio una <dimension> sbagliata (A1:C1) pur contenendo dati fino a J60:
// SheetJS si fida di "!ref" e leggerebbe solo l'intestazione. Si ricalcola
// quindi l'intervallo dalle celle effettivamente presenti.
function ricalcolaIntervallo(foglio: Record<string, unknown>): void {
  const celle = Object.keys(foglio).filter((k) => k[0] !== "!");
  if (celle.length === 0) return;
  const r = { s: { r: Infinity, c: Infinity }, e: { r: 0, c: 0 } };
  celle.forEach((a) => {
    const p = XLSX.utils.decode_cell(a);
    r.s.r = Math.min(r.s.r, p.r); r.s.c = Math.min(r.s.c, p.c);
    r.e.r = Math.max(r.e.r, p.r); r.e.c = Math.max(r.e.c, p.c);
  });
  foglio["!ref"] = XLSX.utils.encode_range(r);
}
// Le date lette con cellDates sono in ora locale: toISOString() le
// convertirebbe in UTC, spostando al giorno prima gli ordini notturni.
function dataLocaleIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function excelDataToIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return dataLocaleIso(v);
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
function matchStato(v: unknown): string {
  const norm = normalizeTesto(v);
  if (STATO_ALIAS[norm]) return STATO_ALIAS[norm];
  return STATI.includes(String(v)) ? String(v) : "Concluso";
}
function matchProvenienza(v: unknown): string {
  const norm = normalizeTesto(v);
  if (PROVENIENZA_ALIAS[norm]) return PROVENIENZA_ALIAS[norm];
  return PROVENIENZE.includes(String(v)) ? String(v) : "Totem";
}
function matchTipologia(v: unknown): string {
  const norm = normalizeTesto(v);
  if (norm.includes("piccol") || norm.includes("small")) return TIPOLOGIE[0];
  if (norm.includes("grand") || norm.includes("large")) return TIPOLOGIE[2];
  if (norm.includes("medi")) return TIPOLOGIE[1];
  return TIPOLOGIE.find((t) => t === v) || TIPOLOGIE[1];
}

function parseFoglioOrdini(
  righeGrezze: Record<string, unknown>[],
  strutture: LockerStruttura[]
): { ordini: LockerOrdine[]; scartati: Array<{ riga: number; motivo: string }> } {
  const risultato: { ordini: LockerOrdine[]; scartati: Array<{ riga: number; motivo: string }> } = { ordini: [], scartati: [] };
  righeGrezze.forEach((riga, idx) => {
    const norm: Record<string, unknown> = {};
    Object.entries(riga).forEach(([k, v]) => { norm[normalizeTesto(k)] = v; });

    const id = trovaCampo(norm, CAMPI_ALIAS.id);
    const dataOrdineRaw = trovaCampo(norm, CAMPI_ALIAS.dataOrdine);

    if (!id || !String(id).trim()) {
      risultato.scartati.push({ riga: idx + 2, motivo: "codice ordine mancante" });
      return;
    }
    if (!dataOrdineRaw) {
      risultato.scartati.push({ riga: idx + 2, motivo: "data ordine mancante" });
      return;
    }

    const strutturaNome = trovaCampo(norm, CAMPI_ALIAS.strutturaNome);
    const strutturaMatch = strutture.find(
      (s) => normalizeTesto(s.nome) === normalizeTesto(strutturaNome) || normalizeTesto(s.citta) === normalizeTesto(strutturaNome)
    );
    const strutturaId = strutturaMatch?.id || strutture[0]?.id || "";

    const dataOrdine = excelDataToIso(dataOrdineRaw);
    // Se manca una colonna "ora" dedicata, l'orario si ricava dalla cella
    // data quando questa Ã¨ un data/ora completo (es. "13/08/2026 12:30:21").
    const oraDa = (colonnaOra: unknown, cellaData: unknown): string =>
      excelOraToHHMM(colonnaOra) || (cellaData instanceof Date ? excelOraToHHMM(cellaData) : "");
    const oraOrdine = oraDa(trovaCampo(norm, CAMPI_ALIAS.oraOrdine), dataOrdineRaw) || "00:00";
    const inizioRaw = trovaCampo(norm, CAMPI_ALIAS.inizio);
    const fineRaw = trovaCampo(norm, CAMPI_ALIAS.fine);
    const inizio = inizioRaw ? excelDataToIso(inizioRaw) : dataOrdine;
    const fine = fineRaw ? excelDataToIso(fineRaw) : dataOrdine;
    const oraInizio = oraDa(trovaCampo(norm, CAMPI_ALIAS.oraInizio), inizioRaw) || oraOrdine;
    const oraFine = oraDa(trovaCampo(norm, CAMPI_ALIAS.oraFine), fineRaw) || oraOrdine;

    const prezzoRaw = trovaCampo(norm, CAMPI_ALIAS.prezzo);
    const prezzo = Number(String(prezzoRaw ?? "0").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
    const stato = matchStato(trovaCampo(norm, CAMPI_ALIAS.stato) ?? "Concluso");
    const provenienza = matchProvenienza(trovaCampo(norm, CAMPI_ALIAS.provenienza) ?? "Totem");
    const tipologia = matchTipologia(trovaCampo(norm, CAMPI_ALIAS.tipologia) ?? TIPOLOGIE[1]);
    const numArmadio = Number(trovaCampo(norm, CAMPI_ALIAS.numArmadio)) || 0;

    risultato.ordini.push({
      id: String(id).trim(), strutturaId, dataOrdine, oraOrdine,
      inizio, oraInizio, fine, oraFine,
      prezzo, stato, numArmadio, tipologia, provenienza,
    });
  });
  return risultato;
}

/* ------------------------------------------------------------------ */
/*  COMPONENTI DI SUPPORTO                                              */
/* ------------------------------------------------------------------ */

interface TagProps { children: React.ReactNode; className?: string }
function Tag({ children, className = "" }: TagProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      {children}
    </span>
  );
}

interface StatCardProps { label: string; value: string | number; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent: string }
function StatCard({ label, value, sub, icon: Icon, accent }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-3 py-3 sm:px-5 sm:py-4 shadow-sm">
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-lg sm:text-2xl font-bold text-stone-900 leading-none font-[Fraunces] truncate">{value}</div>
        <div className="text-[10px] sm:text-xs text-stone-500 mt-1 tracking-wide uppercase">{label}</div>
        {sub && <div className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5 leading-tight">{sub}</div>}
      </div>
    </div>
  );
}

interface ModalProps { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }
function Modal({ title, onClose, children, wide }: ModalProps) {
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
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface FieldProps { label: string; children: React.ReactNode }
function Field({ label, children }: FieldProps) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
function FieldGroup({ label, children }: FieldProps) {
  return (
    <div className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1E8E6E]/40 focus:border-[#1E8E6E]";

/* ------------------------------------------------------------------ */
/*  APP                                                                  */
/* ------------------------------------------------------------------ */

export default function App() {
  const [strutture, setStrutture] = useSyncedResource<LockerStruttura>(api.strutture as never, seedStrutture);
  const [ordini, setOrdini, reloadOrdini] = useSyncedResource<LockerOrdine>(api.ordini as never, seedOrdini);
  const [locali, setLocali] = useSyncedResource<LockerLocale>(api.locali as never, seedLocali);
  const [vendingStrutture] = useSyncedResource<VendingStruttura>(api.vendingStrutture as never, []);
  const [vendingVendite] = useSyncedResource<VendingVendita>(api.vendingVendite as never, []);
  const backendOffline = useBackendOffline();

  const [tab, setTab] = useState("dashboard");
  const TAB_IMPOSTAZIONI = ["sedi"];
  const [impostazioniAperte, setImpostazioniAperte] = useState(TAB_IMPOSTAZIONI.includes(tab));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("locker-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((v) => {
    try { localStorage.setItem("locker-sidebar-collapsed", v ? "0" : "1"); } catch {}
    return !v;
  });
  const [modale, setModale] = useState<ModaleState | null>(null);
  const [periodo, setPeriodo] = useState("mese-corrente");
  const [importRisultato, setImportRisultato] = useState<ImportRisultato | null>(null);

  const [sessione] = useState(() => UHAccounts.loadSession());
  const puoAccedere = UHAccounts.hasAccesso(sessione, APP_ID);
  const isAdminApp = UHAccounts.ruoloIn(sessione, APP_ID) === "Amministratore";

  useEffect(() => {
    if (!isAdminApp && TAB_IMPOSTAZIONI.includes(tab)) setTab("dashboard");
  }, [isAdminApp, tab]);

  const strutturaOf = (id: string): LockerStruttura | undefined => strutture.find((s) => s.id === id);

  function salvaOrdine(dati: LockerOrdine) {
    if (ordini.some((o) => o.id === dati.id) && modale?.type === "modificaOrdine") {
      setOrdini((os) => os.map((o) => (o.id === dati.id ? dati : o)));
    } else {
      setOrdini((os) => [dati, ...os]);
    }
    setModale(null);
  }
  function eliminaOrdine(id: string) {
    setOrdini((os) => os.filter((o) => o.id !== id));
    setModale(null);
  }
  function salvaStruttura(dati: LockerStruttura) {
    // Il form assegna sempre l'id prima di chiamare onSalva: non basta
    // controllare dati.id, occorre verificare se l'id Ã¨ giÃ  presente.
    setStrutture((ss) =>
      ss.some((s) => s.id === dati.id)
        ? ss.map((s) => (s.id === dati.id ? dati : s))
        : [...ss, dati]
    );
    setModale(null);
  }
  function eliminaStruttura(id: string) {
    setStrutture((ss) => ss.filter((s) => s.id !== id));
    setModale(null);
  }
  function salvaLocale(dati: LockerLocale) {
    if (dati.id) {
      setLocali((ls) => ls.map((l) => (l.id === dati.id ? dati : l)));
    } else {
      setLocali((ls) => [...ls, { ...dati, id: nid("LOA") }]);
    }
    setModale(null);
  }
  function eliminaLocale(id: string) {
    setLocali((ls) => ls.filter((l) => l.id !== id));
    setModale(null);
  }

  async function importaOrdiniDaFile(file: File, strutturaId: string, modalita: string) {
    setImportRisultato({ loading: true });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const foglio = wb.Sheets[wb.SheetNames[0]];
      ricalcolaIntervallo(foglio);
      const righe = XLSX.utils.sheet_to_json(foglio, { defval: "" }) as Record<string, unknown>[];
      const { ordini: righeValide, scartati } = parseFoglioOrdini(righe, strutture);
      if (righeValide.length === 0) {
        setImportRisultato({ loading: false, errore: "Nessun ordine valido trovato nel file.", scartati });
        return;
      }
      // Sovrascrive la strutturaId con quella scelta esplicitamente dall'utente
      // (il file potrebbe non avere una colonna sede, o avere un nome diverso).
      const righeConSede = righeValide.map((o) => ({ ...o, strutturaId }));
      const mappa = new Map<string, LockerOrdine>();
      righeConSede.forEach((o) => mappa.set(o.id, o));
      const righeUniche = Array.from(mappa.values());
      const nomeSede = strutturaOf(strutturaId)?.nome ?? "";
      const ordiniApi = api.ordini as unknown as { batch(i: LockerOrdine[]): Promise<void>; remove(id: string): Promise<void> };
      // Aggiorna subito lo stato locale per visibilitÃ  immediata
      if (modalita === "sostituzione") {
        setOrdini((os) => [...righeUniche, ...os.filter((o) => o.strutturaId !== strutturaId)]);
      } else {
        setOrdini((os) => [...righeUniche, ...os]);
      }
      setImportRisultato({ loading: false, refresh: true, totaleImportati: righeUniche.length, scartati, nomeSede, modalita });
      // Salva atomicamente al backend in background
      if (modalita === "sostituzione") {
        const daEliminare = ordini.filter((o) => o.strutturaId === strutturaId);
        Promise.allSettled(daEliminare.map((o) => ordiniApi.remove(o.id))).then(() => {
          ordiniApi.batch(righeUniche).catch((err: Error) => console.error("Batch save fallita:", err));
        });
      } else {
        ordiniApi.batch(righeUniche).catch((err: Error) => console.error("Batch save fallita:", err));
      }
    } catch {
      setImportRisultato({ loading: false, errore: "File non leggibile. Verifica che sia un foglio Excel (.xlsx/.xls) o CSV valido." });
    }
  }

  const ordiniPeriodo = useMemo(() => ordini.filter((o) => inPeriodo(o.dataOrdine, periodo)), [ordini, periodo]);

  if (!puoAccedere) {
    return (
      <div className="min-h-screen w-full bg-[#F3F0E8] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-[#1B2A26] flex items-center justify-center mx-auto mb-4"><Luggage size={26} className="text-white" /></div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
          <p className="text-stone-500 text-sm mb-6">
            {sessione ? "Il tuo account non ha accesso all'applicazione Baggy Locker. Contatta un amministratore del portale."
              : "Devi accedere dalla home page del portale per usare questa applicazione."}
          </p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#1B2A26] hover:bg-[#122019] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
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
        <aside className={`${sidebarCollapsed ? "md:w-14" : "md:w-60"} shrink-0 bg-[#1B2A26] text-stone-200 flex md:flex-col md:sticky md:top-0 md:h-screen transition-all duration-200`}>
          <div className={`border-b border-white/10 hidden md:flex flex-col ${sidebarCollapsed ? "items-center px-0 py-4" : "px-5 py-5"}`}>
            {!sidebarCollapsed && (
              <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3"><ArrowLeft size={12} /> Applicazioni Urban Homy</a>
            )}
            {sidebarCollapsed && (
              <a href="/" className="block mb-2">
                <img src="data:image/png;base64,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" alt="Urban Homy Group" className="w-8 h-8 object-contain" />
              </a>
            )}
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div className="w-8 h-8 rounded-md bg-[#1E8E6E] flex items-center justify-center shrink-0"><Luggage size={16} className="text-white" /></div>
              {!sidebarCollapsed && (
                <div>
                  <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Baggy Locker</div>
                  <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy Â· incassi deposito bagagli</div>
                </div>
              )}
            </div>
          </div>
          <nav className="flex md:flex-col w-full px-2 py-3 gap-1 overflow-x-auto md:overflow-y-auto md:flex-1">
            <a href="/" className="md:hidden flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-stone-400 hover:text-stone-200 hover:bg-white/5 transition" title="Applicazioni Urban Homy"><ArrowLeft size={16} /></a>
            {([{ id: "dashboard", label: "Cruscotto", icon: LayoutGrid }, { id: "ordini", label: "Vendite", icon: Wallet }] as Array<{ id: string; label: string; icon: React.ComponentType<{ size?: number }> }>).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} title={sidebarCollapsed ? t.label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}`}>
                <t.icon size={16} />{!sidebarCollapsed && t.label}
              </button>
            ))}
            {isAdminApp && (
              <div className="md:mt-1">
                <button onClick={() => setImpostazioniAperte((v) => !v)} title={sidebarCollapsed ? "Impostazioni" : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${TAB_IMPOSTAZIONI.includes(tab) ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}`}>
                  <Settings size={16} />{!sidebarCollapsed && <>Impostazioni<ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte ? "rotate-180" : ""}`} /></>}
                </button>
                {impostazioniAperte && (
                  <div className={`flex md:flex-col gap-1 md:mt-1 ${sidebarCollapsed ? "" : "md:pl-4 md:border-l md:border-white/10 md:ml-4"}`}>
                    {([{ id: "sedi", label: "Sedi", icon: MapPin }] as Array<{ id: string; label: string; icon: React.ComponentType<{ size?: number }> }>).map((t) => (
                      <button key={t.id} onClick={() => setTab(t.id)} title={sidebarCollapsed ? t.label : undefined}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}`}>
                        <t.icon size={15} />{!sidebarCollapsed && t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
          <div className="hidden md:flex flex-col border-t border-white/10 mt-auto">
            {!sidebarCollapsed && (
              <div className="px-5 py-3 text-[11px] text-stone-500">
                {strutture.filter((s) => s.attiva).length} sedi attive Â· {ordini.length} ordini importati
              </div>
            )}
            <button onClick={toggleSidebar} title={sidebarCollapsed ? "Espandi menu" : "Comprimi menu"}
              className="flex items-center justify-center py-2.5 text-stone-500 hover:text-stone-300 hover:bg-white/5 transition">
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
          {tab === "dashboard" && <Dashboard ordini={ordini} ordiniPeriodo={ordiniPeriodo} vendingStrutture={vendingStrutture} vendingVendite={vendingVendite} strutture={strutture} periodo={periodo} setPeriodo={setPeriodo} strutturaOf={strutturaOf} onNuovo={() => setModale({ type: "nuovoOrdine", payload: null })} />}
          {tab === "ordini" && <Ordini ordini={ordini} strutture={strutture} strutturaOf={strutturaOf} onApri={(o) => setModale({ type: "modificaOrdine", payload: o })} onNuovo={() => setModale({ type: "nuovoOrdine", payload: null })} onImportaFile={importaOrdiniDaFile} importRisultato={importRisultato} onChiudiImport={() => setImportRisultato(null)} onEliminaTutti={() => setOrdini([])} />}
          {tab === "sedi" && <Sedi strutture={strutture} ordini={ordini} locali={locali} onNuova={() => setModale({ type: "nuovaSede", payload: null })} onApri={(s) => setModale({ type: "modificaSede", payload: s })} onNuovoLocale={(strutturaId) => setModale({ type: "nuovoLocale", payload: null, prefill: { strutturaId } })} onApriLocale={(l) => setModale({ type: "modificaLocale", payload: l })} onEliminaLocale={eliminaLocale} />}
        </main>
      </div>
      {(modale?.type === "nuovoOrdine" || modale?.type === "modificaOrdine") && (
        <OrdineForm esistente={modale.type === "modificaOrdine" ? modale.payload : null} strutture={strutture} onSalva={salvaOrdine} onElimina={modale.type === "modificaOrdine" ? () => eliminaOrdine(modale.payload.id) : null} onClose={() => setModale(null)} />
      )}
      {(modale?.type === "nuovaSede" || modale?.type === "modificaSede") && (
        <StrutturaForm esistente={modale.type === "modificaSede" ? modale.payload : null} onSalva={salvaStruttura} onElimina={modale.type === "modificaSede" ? () => eliminaStruttura(modale.payload.id) : null} onClose={() => setModale(null)} />
      )}
      {(modale?.type === "nuovoLocale" || modale?.type === "modificaLocale") && (
        <LocaleForm esistente={modale.type === "modificaLocale" ? modale.payload : null} prefill={modale.type === "nuovoLocale" ? modale.prefill : undefined} strutture={strutture} onSalva={salvaLocale} onElimina={modale.type === "modificaLocale" ? () => eliminaLocale(modale.payload.id) : null} onClose={() => setModale(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                           */
/* ------------------------------------------------------------------ */

interface DashboardProps {
  ordini: LockerOrdine[]; ordiniPeriodo: LockerOrdine[];
  vendingStrutture: VendingStruttura[]; vendingVendite: VendingVendita[];
  strutture: LockerStruttura[]; periodo: string;
  setPeriodo: (p: string) => void;
  strutturaOf: (id: string) => LockerStruttura | undefined;
  onNuovo: () => void;
}

function Dashboard({ ordini, ordiniPeriodo, vendingStrutture, vendingVendite, strutture, periodo, setPeriodo, strutturaOf: _strutturaOf, onNuovo }: DashboardProps) {
  const struttureAttive = useMemo(() => strutture.filter((s) => s.attiva), [strutture]);
  const vendingVenditePeriodo = useMemo(
    () => vendingVendite.filter((v) => v.stato === "Completata" && inPeriodo(v.data, periodo)),
    [vendingVendite, periodo]
  );
  const [sediSelezionate, setSediSelezionate] = useState<Set<string>>(() => new Set(struttureAttive.map((s) => s.id)));
  useEffect(() => {
    setSediSelezionate((prev) => {
      let cambiato = false;
      const next = new Set(prev);
      struttureAttive.forEach((s) => { if (!next.has(s.id)) { next.add(s.id); cambiato = true; } });
      return cambiato ? next : prev;
    });
  }, [struttureAttive]);
  function toggleSede(id: string) {
    setSediSelezionate((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  const ordiniFiltrati = useMemo(() => ordini.filter((o) => sediSelezionate.has(o.strutturaId)), [ordini, sediSelezionate]);
  const ordiniPeriodoFiltrati = useMemo(() => ordiniPeriodo.filter((o) => sediSelezionate.has(o.strutturaId)), [ordiniPeriodo, sediSelezionate]);

  const stats = useMemo(() => {
    const conclusiPeriodo = ordiniPeriodoFiltrati.filter((o) => o.stato === "Concluso");
    const totaleIncasso = ordiniPeriodoFiltrati.reduce((s, o) => s + incassato(o), 0);
    const totaleAttesa = ordiniPeriodoFiltrati.reduce((s, o) => s + inAttesa(o), 0);
    const nAttesa = ordiniPeriodoFiltrati.filter((o) => o.stato === "InAttesaDiPagamento").length;
    const durataMedia = conclusiPeriodo.length ? conclusiPeriodo.reduce((s, o) => s + durataOre(o), 0) / conclusiPeriodo.length : 0;
    return { totaleIncasso, ordiniConclusi: conclusiPeriodo.length, totaleAttesa, nAttesa, mediaPerOrdine: conclusiPeriodo.length ? totaleIncasso / conclusiPeriodo.length : 0, durataMedia };
  }, [ordiniPeriodoFiltrati]);

  const statsVending = useMemo(() => {
    let totale = 0;
    let nVendite = 0;
    struttureAttive.forEach((s) => {
      const idVendingSede = vendingStrutture.filter((vs) => vs.sedeCentraleId === s.sedeCentraleId).map((vs) => vs.id);
      const venditeSede = vendingVenditePeriodo.filter((v) => idVendingSede.includes(v.strutturaId));
      totale += venditeSede.reduce((sum, v) => sum + totaleVendita(v), 0);
      nVendite += venditeSede.length;
    });
    return { totale, nVendite };
  }, [struttureAttive, vendingStrutture, vendingVenditePeriodo]);

  const giorniGrafico = useMemo(() => {
    const GIORNI_PERIODO: Record<string, number> = { "sett-corrente": 7, "sett-prec": 7, "mese-corrente": 31, "mese-prec": 31, "anno-corrente": 365, "anno-prec": 365 };
    if (periodo in GIORNI_PERIODO) return GIORNI_PERIODO[periodo];
    const date = ordiniFiltrati.map((o) => o.dataOrdine).filter(Boolean).sort();
    if (date.length === 0) return 30;
    const primo = new Date(date[0] + "T00:00:00");
    const giorni = Math.round((oggi.getTime() - primo.getTime()) / 86400000) + 1;
    return Math.min(180, Math.max(7, giorni));
  }, [periodo, ordiniFiltrati]);

  const [raggruppamento, setRaggruppamento] = useState("giorno");

  const sediPerSegmenti = useMemo(() => struttureAttive.filter((s) => sediSelezionate.has(s.id)), [struttureAttive, sediSelezionate]);
  function segmentiDi(bucketOrdini: LockerOrdine[]): Segmento[] {
    return sediPerSegmenti.map((s) => ({
      id: s.id, nome: s.nome, colore: coloreSede(struttureAttive, s.id),
      valore: bucketOrdini.filter((o) => o.strutturaId === s.id).reduce((sum, o) => sum + incassato(o), 0),
    }));
  }

  const perBucket = useMemo((): Bucket[] => {
    if (raggruppamento === "settimana") {
      const nSettimane = Math.max(1, Math.ceil(giorniGrafico / 7));
      const arr: Bucket[] = [];
      for (let w = nSettimane - 1; w >= 0; w--) {
        const fine = new Date(oggi); fine.setDate(fine.getDate() - w * 7);
        const inizio = new Date(fine); inizio.setDate(inizio.getDate() - 6);
        const inizioIso = inizio.toISOString().slice(0, 10);
        const fineIso = fine.toISOString().slice(0, 10);
        const bucketOrdini = ordiniFiltrati.filter((o) => o.dataOrdine >= inizioIso && o.dataOrdine <= fineIso);
        const segmenti = segmentiDi(bucketOrdini);
        const tot = segmenti.reduce((s, seg) => s + seg.valore, 0);
        arr.push({ key: inizioIso, label: fmtDataBreve(inizioIso), title: `${fmtData(inizioIso)} â€“ ${fmtData(fineIso)}`, totale: tot, segmenti });
      }
      return arr;
    }
    if (raggruppamento === "mese") {
      const mesi: string[] = [];
      for (let n = giorniGrafico - 1; n >= 0; n--) {
        const d = new Date(oggi); d.setDate(d.getDate() - n);
        const ym = d.toISOString().slice(0, 7);
        if (!mesi.includes(ym)) mesi.push(ym);
      }
      return mesi.map((ym) => {
        const bucketOrdini = ordiniFiltrati.filter((o) => o.dataOrdine.slice(0, 7) === ym);
        const segmenti = segmentiDi(bucketOrdini);
        const tot = segmenti.reduce((s, seg) => s + seg.valore, 0);
        const [y, m] = ym.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
        return { key: ym, label, title: label, totale: tot, segmenti };
      });
    }
    const arr: Bucket[] = [];
    for (let n = giorniGrafico - 1; n >= 0; n--) {
      const d = new Date(oggi); d.setDate(d.getDate() - n);
      const iso = d.toISOString().slice(0, 10);
      const bucketOrdini = ordiniFiltrati.filter((o) => o.dataOrdine === iso);
      const segmenti = segmentiDi(bucketOrdini);
      const tot = segmenti.reduce((s, seg) => s + seg.valore, 0);
      arr.push({ key: iso, label: null, title: fmtData(iso), totale: tot, segmenti });
    }
    return arr;
  }, [ordiniFiltrati, giorniGrafico, raggruppamento, sediPerSegmenti]);
  const maxBucket = Math.max(1, ...perBucket.map((g) => g.totale));

  const [metricaTipologie, setMetricaTipologie] = useState<"pezzi" | "incasso">("pezzi");
  const topTipologieBase = useMemo((): TopTipologia[] => {
    const conclusi = ordiniPeriodoFiltrati.filter((o) => o.stato === "Concluso");
    const perTipologia = new Map<string, Record<string, { pezzi: number; incasso: number }>>();
    conclusi.forEach((o) => {
      const key = o.tipologia || "â€”";
      if (!perTipologia.has(key)) perTipologia.set(key, {});
      const bucket = perTipologia.get(key)!;
      if (!bucket[o.strutturaId]) bucket[o.strutturaId] = { pezzi: 0, incasso: 0 };
      bucket[o.strutturaId].pezzi += 1;
      bucket[o.strutturaId].incasso += incassato(o);
    });
    return TIPOLOGIE.map((tipologia) => {
      const perSede = perTipologia.get(tipologia) || {};
      const segmenti = sediPerSegmenti.map((s) => {
        const dati = perSede[s.id] || { pezzi: 0, incasso: 0 };
        return { id: s.id, nome: s.nome, colore: coloreSede(struttureAttive, s.id), pezzi: dati.pezzi, incasso: dati.incasso };
      });
      return { tipologia, segmenti, totalePezzi: segmenti.reduce((s, seg) => s + seg.pezzi, 0), totaleIncasso: segmenti.reduce((s, seg) => s + seg.incasso, 0) };
    });
  }, [ordiniPeriodoFiltrati, sediPerSegmenti, struttureAttive]);

  const campoTipologie: "totaleIncasso" | "totalePezzi" = metricaTipologie === "incasso" ? "totaleIncasso" : "totalePezzi";
  const topTipologie = useMemo(() => {
    return topTipologieBase.filter((r) => r[campoTipologie] > 0).sort((a, b) => b[campoTipologie] - a[campoTipologie]);
  }, [topTipologieBase, campoTipologie]);
  const maxTipologia = Math.max(1, ...topTipologie.map((t) => t[campoTipologie]));
  const fmtTipologia = (n: number) => (metricaTipologie === "incasso" ? fmtEuro(n) : `${n} ordini`);

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-xl md:text-[28px] font-semibold text-stone-900">Cruscotto incassi</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">Baggy Locker Â· Gruppo Urban Homy</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 mb-5">
        {PERIODI.map((p) => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition ${periodo === p.id ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Incasso totale" value={fmtEuro(stats.totaleIncasso)} sub={`${stats.ordiniConclusi} ordini conclusi`} icon={Euro} accent="bg-[#1B2A26]" />
        <StatCard label="Ordini conclusi" value={stats.ordiniConclusi} icon={Package} accent="bg-[#1E8E6E]" />
        <StatCard label="In attesa di pagamento" value={fmtEuro(stats.totaleAttesa)} sub={`${stats.nAttesa} ordini`} icon={Clock3} accent="bg-amber-500" />
        <StatCard label="Media per ordine" value={fmtEuro(stats.mediaPerOrdine)} sub={`durata media ${stats.durataMedia.toFixed(1)} h`} icon={Wallet} accent="bg-teal-600" />
        <StatCard label="Vending machine" value={fmtEuro(statsVending.totale)} sub={`${statsVending.nVendite} vendite`} icon={ShoppingCart} accent="bg-sky-600" />
      </div>
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-[Fraunces] font-semibold text-stone-900">Andamento ultimi {giorniGrafico} giorni</h2>
          <div className="flex gap-1.5">
            {[{ id: "giorno", label: "Giorno" }, { id: "settimana", label: "Settimana" }, { id: "mese", label: "Mese" }].map((r) => (
              <button key={r.id} onClick={() => setRaggruppamento(r.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${raggruppamento === r.id ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {sediPerSegmenti.length > 1 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {sediPerSegmenti.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: coloreSede(struttureAttive, s.id) }} />{s.nome}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1 h-32 overflow-x-auto">
          {perBucket.map((g) => {
            const segmentiValidi = g.segmenti.filter((seg) => seg.valore > 0);
            const tooltip = `${g.title} Â· ${fmtEuro(g.totale)}` + segmentiValidi.map((seg) => `\n${seg.nome}: ${fmtEuro(seg.valore)}`).join("");
            return (
              <div key={g.key} className="h-full flex-1 min-w-[8px] flex flex-col items-center justify-end gap-1.5 group relative">
                <div className="text-[10px] text-stone-400 opacity-0 group-hover:opacity-100 transition font-mono-tag whitespace-nowrap">{fmtEuro(g.totale)}</div>
                <div className="w-full rounded-t shrink-0 overflow-hidden flex flex-col-reverse bg-stone-100" style={{ height: `${Math.max(4, (g.totale / maxBucket) * 100)}%` }} title={tooltip}>
                  {segmentiValidi.map((seg) => (<div key={seg.id} style={{ height: `${(seg.valore / g.totale) * 100}%`, backgroundColor: seg.colore }} />))}
                </div>
                {g.label && <div className="text-[10px] text-stone-400 font-mono-tag whitespace-nowrap">{g.label}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-stone-400 mb-2">Clicca una sede per includerla o escluderla dai totali, dal grafico qui sopra e dalla tipologia locker qui sotto.</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {struttureAttive.map((s) => {
          const diSede = ordiniPeriodo.filter((i) => i.strutturaId === s.id);
          const tot = diSede.reduce((sum, o) => sum + incassato(o), 0);
          const idVendingSede = vendingStrutture.filter((vs) => vs.sedeCentraleId === s.sedeCentraleId).map((vs) => vs.id);
          const venditeSede = vendingVenditePeriodo.filter((v) => idVendingSede.includes(v.strutturaId));
          const totVendite = venditeSede.reduce((sum, v) => sum + totaleVendita(v), 0);
          const selezionata = sediSelezionate.has(s.id);
          return (
            <button type="button" key={s.id} onClick={() => toggleSede(s.id)}
              className={`text-left bg-white border rounded-xl shadow-sm px-5 py-4 transition ${selezionata ? "border-[#1E8E6E] ring-1 ring-[#1E8E6E]" : "border-stone-200 opacity-50 hover:opacity-80"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><MapPin size={14} className="text-stone-400" /><span className="font-semibold text-sm text-stone-900">{s.nome}</span></div>
                <CheckCircle2 size={18} className={selezionata ? "text-[#1E8E6E]" : "text-stone-300"} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-stone-900 font-[Fraunces]">{fmtEuro(tot)}</div>
              <div className="text-xs text-stone-500 mt-1">{diSede.filter((o) => o.stato === "Concluso").length} ordini conclusi nel periodo selezionato</div>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-stone-100">
                <ShoppingCart size={12} className="text-stone-400 shrink-0" />
                <span className="text-sm font-semibold text-stone-700">{fmtEuro(totVendite)}</span>
                <span className="text-[11px] text-stone-400">vending machine Â· {venditeSede.length} vendite</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-[Fraunces] font-semibold text-stone-900">Tipologia locker</h2>
          <div className="flex gap-1.5">
            {[{ id: "pezzi", label: "Ordini conclusi" }, { id: "incasso", label: "Importo incassato" }].map((m) => (
              <button key={m.id} onClick={() => setMetricaTipologie(m.id as "pezzi" | "incasso")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${metricaTipologie === m.id ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-stone-400 mb-4">{metricaTipologie === "incasso" ? "Incasso" : "Ordini conclusi"} nel periodo selezionato, per sede</p>
        {topTipologie.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">Nessun ordine concluso nel periodo selezionato.</div>
        ) : (
          <div className="grid gap-3">
            {topTipologie.map((t) => {
              const valore = t[campoTipologie];
              const segmentiValidi = t.segmenti.map((seg) => ({ ...seg, valore: metricaTipologie === "incasso" ? seg.incasso : seg.pezzi })).filter((seg) => seg.valore > 0);
              const tooltip = `${t.tipologia} Â· ${fmtTipologia(valore)}` + segmentiValidi.map((seg) => `\n${seg.nome}: ${fmtTipologia(seg.valore)}`).join("");
              return (
                <div key={t.tipologia}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm text-stone-800 truncate flex items-center gap-1.5"><DoorClosed size={14} className="text-stone-400 shrink-0" />{t.tipologia}</span>
                    <span className="text-sm font-semibold text-stone-900 font-mono-tag shrink-0">{fmtTipologia(valore)}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-stone-50">
                    <div className="h-full rounded-full overflow-hidden flex" style={{ width: `${(valore / maxTipologia) * 100}%` }} title={tooltip}>
                      {segmentiValidi.map((seg) => (<div key={seg.id} style={{ width: `${(seg.valore / valore) * 100}%`, backgroundColor: seg.colore }} />))}
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
/*  ORDINI                                                               */
/* ------------------------------------------------------------------ */

interface OrdiniProps {
  ordini: LockerOrdine[]; strutture: LockerStruttura[];
  strutturaOf: (id: string) => LockerStruttura | undefined;
  onApri: (o: LockerOrdine) => void; onNuovo: () => void;
  onImportaFile: (f: File, strutturaId: string, modalita: string) => Promise<void>;
  importRisultato: ImportRisultato | null;
  onChiudiImport: () => void;
  onEliminaTutti: () => void;
}
interface ImportaOrdiniFormProps { strutture: LockerStruttura[]; onConferma: (strutturaId: string, modalita: string) => void; onClose: () => void; }

function Ordini({ ordini, strutture, strutturaOf, onApri, onNuovo, onImportaFile, importRisultato, onChiudiImport, onEliminaTutti }: OrdiniProps) {
  const [filtroStruttura, setFiltroStruttura] = useState("");
  const [filtroStato, setFiltroStato] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("tutto");
  const [ricerca, setRicerca] = useState("");
  const [fileInAttesa, setFileInAttesa] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const elenco = ordini
    .filter((o) => !filtroStruttura || o.strutturaId === filtroStruttura)
    .filter((o) => !filtroStato || o.stato === filtroStato)
    .filter((o) => inPeriodo(o.dataOrdine, filtroPeriodo))
    .filter((o) => !ricerca || o.id.toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => (b.dataOrdine + b.oraOrdine).localeCompare(a.dataOrdine + a.oraOrdine));

  const totalePeriodo = elenco.reduce((s, o) => s + incassato(o), 0);

  function onFileScelto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setFileInAttesa(file);
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-xl md:text-2xl font-semibold text-stone-900">Vendite</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">Elenco ordini del deposito bagagli</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileScelto} />
          <button
            onClick={() => {
              if (ordini.length === 0) return;
              if (window.confirm(`Vuoi davvero cancellare tutti i ${ordini.length} ordini? L'operazione Ã¨ irreversibile.`)) {
                onEliminaTutti();
              }
            }}
            disabled={ordini.length === 0}
            className="flex items-center gap-2 bg-white border border-stone-300 hover:border-rose-400 hover:text-rose-600 text-stone-500 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-30"
          >
            <Trash2 size={16} /> Cancella tutto
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importRisultato?.loading}
            className="flex items-center gap-2 bg-white border border-stone-300 hover:border-[#1E8E6E] text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50">
            <Upload size={16} /> {importRisultato?.loading ? "Importazioneâ€¦" : "Importa da Excel"}
          </button>
        </div>
      </header>
      {importRisultato && !importRisultato.loading && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${importRisultato.errore ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-emerald-50 border-emerald-300 text-emerald-800"}`}>
          <div className="flex items-start gap-2.5">
            {importRisultato.errore ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <div className="flex-1">
              {importRisultato.errore ? <div className="font-medium">{importRisultato.errore}</div> : (
                <>
                  <div className="font-medium">
                    {importRisultato.totaleImportati} ordini importati per {importRisultato.nomeSede}
                    {" "}({importRisultato.modalita === "sostituzione" ? "sostituiti gli ordini esistenti della sede" : "aggiunti agli ordini esistenti"})
                    {importRisultato.scartati && importRisultato.scartati.length > 0 && `, ${importRisultato.scartati.length} righe scartate`}.
                  </div>
                  {importRisultato.scartati && importRisultato.scartati.length > 0 && (
                    <ul className="mt-1.5 text-xs text-emerald-700/80 list-disc list-inside space-y-0.5">
                      {importRisultato.scartati.slice(0, 8).map((s, i) => (<li key={i}>Riga {s.riga}: {s.motivo}</li>))}
                      {importRisultato.scartati.length > 8 && <li>â€¦e altre {importRisultato.scartati.length - 8} righe.</li>}
                    </ul>
                  )}
                </>
              )}
            </div>
            <button onClick={onChiudiImport} className="text-current opacity-60 hover:opacity-100 shrink-0"><X size={15} /></button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-5 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <Search size={15} className="text-stone-400 shrink-0" />
          <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per codice ordineâ€¦" className="text-sm outline-none w-full bg-transparent" />
        </div>
        <select value={filtroStruttura} onChange={(e) => setFiltroStruttura(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutte le sedi</option>
          {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti gli stati</option>
          {STATI.map((s) => <option key={s} value={s}>{STATI_LABEL[s]}</option>)}
        </select>
        <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className={inputCls + " w-auto text-xs"}>
          {PERIODI.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <span className="ml-auto text-sm font-semibold text-stone-700">Incassato: {fmtEuro(totalePeriodo)}</span>
      </div>
      {elenco.length === 0 ? (
        <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">Nessun ordine corrisponde ai filtri selezionati.</div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Codice</th><th className="px-4 py-3">Sede</th><th className="px-4 py-3">Data ordine</th>
                <th className="px-4 py-3">Noleggio</th><th className="px-4 py-3">Tipologia</th><th className="px-4 py-3">Armadio</th>
                <th className="px-4 py-3">Canale</th><th className="px-4 py-3 text-right">Prezzo</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {elenco.map((o) => {
                const StatoIcon = statoIcon[o.stato];
                return (
                  <tr key={o.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition cursor-pointer" onClick={() => onApri(o)}>
                    <td className="px-4 py-3 font-mono-tag font-semibold text-stone-900 whitespace-nowrap">{o.id}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{strutturaOf(o.strutturaId)?.nome ?? "â€”"}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{fmtData(o.dataOrdine)} Â· {o.oraOrdine}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap font-mono-tag">{o.oraInizio}â€“{o.oraFine}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{o.tipologia.split(" - ")[0]}</td>
                    <td className="px-4 py-3 text-stone-600">{o.numArmadio > 0 ? o.numArmadio : "â€”"}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{o.provenienza}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">{fmtEuro(o.prezzo)}</td>
                    <td className="px-4 py-3"><Tag className={statoColor[o.stato] + " border-transparent whitespace-nowrap"}>{StatoIcon && <StatoIcon size={11} />} {STATI_LABEL[o.stato]}</Tag></td>
                    <td className="px-4 py-3"><button onClick={(e) => { e.stopPropagation(); onApri(o); }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"><Pencil size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {fileInAttesa && (
        <ImportaOrdiniForm
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

function ImportaOrdiniForm({ strutture, onConferma, onClose }: ImportaOrdiniFormProps) {
  const [strutturaId, setStrutturaId] = useState<string>(strutture.find((s) => s.attiva)?.id ?? strutture[0]?.id ?? "");
  const [modalita, setModalita] = useState<string>("sostituzione");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!strutturaId) return;
    onConferma(strutturaId, modalita);
  }
  return (
    <Modal title="Importa ordini da Excel" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Per quale sede stai caricando questi ordini?">
          <select required className={inputCls} value={strutturaId} onChange={(e) => setStrutturaId(e.target.value)}>
            {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <FieldGroup label="ModalitÃ ">
          <div className="grid gap-2">
            <button
              type="button" onClick={() => setModalita("sostituzione")}
              className={`text-left px-3 py-2.5 rounded-lg border transition ${modalita === "sostituzione" ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-700 border-stone-300"}`}
            >
              <div className="text-sm font-semibold">Sostituzione</div>
              <div className={`text-xs mt-0.5 ${modalita === "sostituzione" ? "text-stone-300" : "text-stone-500"}`}>
                Rimpiazza tutti gli ordini giÃ  presenti per questa sede con quelli del file.
              </div>
            </button>
            <button
              type="button" onClick={() => setModalita("aggiunta")}
              className={`text-left px-3 py-2.5 rounded-lg border transition ${modalita === "aggiunta" ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-700 border-stone-300"}`}
            >
              <div className="text-sm font-semibold">Aggiunta</div>
              <div className={`text-xs mt-0.5 ${modalita === "aggiunta" ? "text-stone-300" : "text-stone-500"}`}>
                Accoda gli ordini del file a quelli giÃ  presenti, senza toccarli.
              </div>
            </button>
          </div>
        </FieldGroup>
        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-stone-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
          <button type="submit" disabled={!strutturaId} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1E8E6E] hover:bg-[#186f57] text-white disabled:opacity-50">Importa</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  FORM ORDINE                                                          */
/* ------------------------------------------------------------------ */

type OrdineFormState = Omit<LockerOrdine, "prezzo" | "numArmadio"> & { prezzo: string | number; numArmadio: string | number };

interface OrdineFormProps { esistente: LockerOrdine | null; strutture: LockerStruttura[]; onSalva: (d: LockerOrdine) => void; onElimina: (() => void) | null; onClose: () => void }
function OrdineForm({ esistente, strutture, onSalva, onElimina, onClose }: OrdineFormProps) {
  const strutturaAttive = strutture.filter((s) => s.attiva);
  const vuoto: OrdineFormState = {
    id: "", strutturaId: strutturaAttive[0]?.id ?? "",
    dataOrdine: oggi.toISOString().slice(0, 10), oraOrdine: oggi.toTimeString().slice(0, 5),
    inizio: oggi.toISOString().slice(0, 10), oraInizio: oggi.toTimeString().slice(0, 5),
    fine: oggi.toISOString().slice(0, 10), oraFine: oggi.toTimeString().slice(0, 5),
    prezzo: "", stato: "Concluso", numArmadio: "", tipologia: TIPOLOGIE[0], provenienza: "Totem",
  };
  const [f, setF] = useState<OrdineFormState>(esistente ? { ...esistente, prezzo: esistente.prezzo, numArmadio: esistente.numArmadio } : vuoto);
  function upd(patch: Partial<OrdineFormState>) { setF((prev) => ({ ...prev, ...patch })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.strutturaId || !f.dataOrdine || !String(f.id).trim()) return;
    onSalva({ ...f, id: String(f.id), prezzo: Number(f.prezzo) || 0, numArmadio: Number(f.numArmadio) || 0 });
  }

  return (
    <Modal title={esistente ? "Modifica ordine" : "Nuovo ordine"} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Codice ordine"><input required className={inputCls + " font-mono-tag"} value={String(f.id)} onChange={(e) => upd({ id: e.target.value })} placeholder="Es. AB12CD26" disabled={!!esistente} /></Field>
          <Field label="Sede"><select className={inputCls} value={f.strutturaId} onChange={(e) => upd({ strutturaId: e.target.value })}>{strutturaAttive.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data ordine"><input required type="date" className={inputCls} value={f.dataOrdine} onChange={(e) => upd({ dataOrdine: e.target.value })} /></Field>
          <Field label="Ora ordine"><input type="time" className={inputCls} value={f.oraOrdine} onChange={(e) => upd({ oraOrdine: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inizio noleggio"><input type="date" className={inputCls} value={f.inizio} onChange={(e) => upd({ inizio: e.target.value })} /></Field>
          <Field label="Ora inizio"><input type="time" className={inputCls} value={f.oraInizio} onChange={(e) => upd({ oraInizio: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fine noleggio"><input type="date" className={inputCls} value={f.fine} onChange={(e) => upd({ fine: e.target.value })} /></Field>
          <Field label="Ora fine"><input type="time" className={inputCls} value={f.oraFine} onChange={(e) => upd({ oraFine: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipologia armadio"><select className={inputCls} value={f.tipologia} onChange={(e) => upd({ tipologia: e.target.value })}>{TIPOLOGIE.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="NÂ° armadio"><input type="number" min="0" className={inputCls} value={String(f.numArmadio)} onChange={(e) => upd({ numArmadio: e.target.value })} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prezzo (â‚¬)"><input required type="number" min="0" step="0.01" className={inputCls} value={String(f.prezzo)} onChange={(e) => upd({ prezzo: e.target.value })} placeholder="0.00" /></Field>
          <Field label="Stato"><select className={inputCls} value={f.stato} onChange={(e) => upd({ stato: e.target.value })}>{STATI.map((s) => <option key={s} value={s}>{STATI_LABEL[s]}</option>)}</select></Field>
        </div>
        <Field label="Provenienza">
          <div className="flex gap-2">
            {PROVENIENZE.map((p) => (
              <button type="button" key={p} onClick={() => upd({ provenienza: p })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border transition ${f.provenienza === p ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-500 border-stone-300"}`}>{p}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (<button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold"><Trash2 size={15} /> Elimina</button>) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1E8E6E] hover:bg-[#186f57] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  SEDI                                                                 */
/* ------------------------------------------------------------------ */

interface SediProps {
  strutture: LockerStruttura[]; ordini: LockerOrdine[]; locali: LockerLocale[];
  onNuova: () => void; onApri: (s: LockerStruttura) => void;
  onNuovoLocale: (strutturaId: string) => void;
  onApriLocale: (l: LockerLocale) => void; onEliminaLocale: (id: string) => void;
}

function Sedi({ strutture, ordini, locali, onNuova, onApri, onNuovoLocale, onApriLocale, onEliminaLocale }: SediProps) {
  const sediCentrali = UHAccounts.loadSedi();
  const sedeCentraleDi = (s: LockerStruttura) => sediCentrali.find((sc: { id: string }) => sc.id === s.sedeCentraleId) || null;
  const [espansa, setEspansa] = useState<Set<string>>(() => new Set());
  function toggleEspansa(id: string) {
    setEspansa((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-xl md:text-2xl font-semibold text-stone-900">Sedi</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">Attiva una sede quando il servizio Baggy Locker parte davvero</p>
        </div>
        <button onClick={onNuova} className="flex items-center gap-2 bg-[#1E8E6E] hover:bg-[#186f57] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"><Plus size={16} /> Nuova sede</button>
      </header>
      <div className="grid gap-3">
        {strutture.map((s) => {
          const sedeCentrale = sedeCentraleDi(s) as { id: string; nome: string; citta?: string; tipo?: string; indirizzo?: string; attiva: boolean } | null;
          const nOrdini = ordini.filter((o) => o.strutturaId === s.id).length;
          const localiSede = locali.filter((l) => l.strutturaId === s.id);
          const totali = localiTotaliPerTipo(locali, s.id);
          const totaleLockerSede = totaleLocker(totali);
          const aperta = espansa.has(s.id);
          const nome = sedeCentrale ? sedeCentrale.nome : s.nome;
          const citta = sedeCentrale ? sedeCentrale.citta : s.citta;
          const attiva = sedeCentrale ? sedeCentrale.attiva : s.attiva;
          return (
            <div key={s.id} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <button onClick={() => toggleEspansa(s.id)} className="w-10 h-10 rounded-lg bg-[#1B2A26] flex items-center justify-center shrink-0"><MapPin size={18} className="text-white" /></button>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleEspansa(s.id)}>
                  <div className="font-semibold text-sm text-stone-900 flex items-center gap-1.5 flex-wrap">
                    {nome}
                    {!sedeCentrale && <Tag className="bg-amber-50 text-amber-700 border-amber-300">Da collegare a una sede centrale</Tag>}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{citta} Â· {nOrdini} ordini registrati Â· {totaleLockerSede} locker censiti in {localiSede.length} local{localiSede.length === 1 ? "e" : "i"}</div>
                </div>
                <Tag className={attiva ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-stone-50 text-stone-500 border-stone-300"}>{attiva ? "Servizio attivo" : "In arrivo"}</Tag>
                <button onClick={() => onApri(s)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0"><Pencil size={15} /></button>
                <button onClick={() => toggleEspansa(s.id)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0"><ChevronDown size={16} className={`transition-transform ${aperta ? "rotate-180" : ""}`} /></button>
              </div>
              {aperta && (
                <div className="border-t border-stone-200 bg-stone-50/60 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-2">
                      {TIPOLOGIE.map((t) => (<Tag key={t} className="bg-white text-stone-700 border-stone-300">{t.split(" - ")[0]}: <span className="font-semibold">{totali[t]}</span></Tag>))}
                    </div>
                    <button onClick={() => onNuovoLocale(s.id)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1E8E6E] hover:text-[#186f57]"><Plus size={14} /> Aggiungi locale</button>
                  </div>
                  {localiSede.length === 0 ? (
                    <div className="text-center py-6 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-lg">Nessun locale censito per questa sede.</div>
                  ) : (
                    <div className="grid gap-2">
                      {localiSede.map((l) => (
                        <div key={l.id} className="bg-white border border-stone-200 rounded-lg px-4 py-3 flex items-center gap-3">
                          <DoorClosed size={16} className="text-stone-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-stone-900">{l.nome}</div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {TIPOLOGIE.map((t) => (Number(l.conteggi?.[t]) || 0) > 0 && (
                                <span key={t} className="text-[11px] font-mono-tag text-stone-500 bg-stone-100 rounded px-1.5 py-0.5">{t.split(" - ")[0]} Ã— {l.conteggi[t]}</span>
                              ))}
                              {totaleLocker(l.conteggi) === 0 && <span className="text-[11px] text-stone-400">Nessun locker indicato</span>}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-stone-500 shrink-0">{totaleLocker(l.conteggi)} totali</span>
                          <button onClick={() => onApriLocale(l)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0"><Pencil size={14} /></button>
                          <button onClick={() => onEliminaLocale(l.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 shrink-0"><Trash2 size={14} /></button>
                        </div>
                      ))}
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

interface StrutturaFormProps { esistente: LockerStruttura | null; onSalva: (d: LockerStruttura) => void; onElimina: (() => void) | null; onClose: () => void }
function StrutturaForm({ esistente, onSalva, onElimina, onClose }: StrutturaFormProps) {
  const sediCentrali = UHAccounts.loadSedi() as Array<{ id: string; nome: string; citta?: string; tipo?: string; indirizzo?: string; attiva: boolean }>;
  const vuoto = { id: null as string | null, sedeCentraleId: "" };
  const [f, setF] = useState(esistente ? { id: esistente.id, sedeCentraleId: esistente.sedeCentraleId || "" } : vuoto);
  function upd(patch: Partial<typeof f>) { setF((prev) => ({ ...prev, ...patch })); }
  const sedeScelta = sediCentrali.find((s) => s.id === f.sedeCentraleId) || null;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sedeScelta) return;
    onSalva({ id: f.id ?? nid("LOC"), sedeCentraleId: sedeScelta.id, nome: sedeScelta.nome, citta: sedeScelta.citta ?? "", attiva: sedeScelta.attiva });
  }
  return (
    <Modal title={esistente ? "Modifica sede" : "Nuova sede"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Sede centrale">
          <select required className={inputCls} value={f.sedeCentraleId} onChange={(e) => upd({ sedeCentraleId: e.target.value })}>
            <option value="">Seleziona sedeâ€¦</option>
            {sediCentrali.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.citta ? ` â€” ${s.citta}` : ""}</option>)}
          </select>
          <span className="text-xs text-stone-400 mt-1.5 block">Le sedi si gestiscono centralmente nell'app "Utenti e accessi" (Impostazioni â†’ Sedi).</span>
        </Field>
        {sedeScelta && (
          <div className="border border-stone-200 rounded-lg px-3.5 py-2.5 mb-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-stone-800">{sedeScelta.nome}</span>
              {sedeScelta.tipo && <Tag className="bg-stone-50 text-stone-500 border-stone-300">{sedeScelta.tipo}</Tag>}
              <Tag className={sedeScelta.attiva ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-stone-50 text-stone-500 border-stone-300"}>{sedeScelta.attiva ? "Attiva" : "Non attiva"}</Tag>
            </div>
            {(sedeScelta.citta || sedeScelta.indirizzo) && <div className="text-xs text-stone-500 mt-1">{[sedeScelta.indirizzo, sedeScelta.citta].filter(Boolean).join(", ")}</div>}
          </div>
        )}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (<button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold"><Trash2 size={15} /> Elimina</button>) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1E8E6E] hover:bg-[#186f57] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

interface LocaleFormProps { esistente: LockerLocale | null; prefill?: { strutturaId: string }; strutture: LockerStruttura[]; onSalva: (d: LockerLocale) => void; onElimina: (() => void) | null; onClose: () => void }
function LocaleForm({ esistente, prefill, strutture, onSalva, onElimina, onClose }: LocaleFormProps) {
  const vuoto: LockerLocale = {
    id: "", strutturaId: prefill?.strutturaId || strutture[0]?.id || "", nome: "",
    conteggi: Object.fromEntries(TIPOLOGIE.map((t) => [t, 0])),
  };
  const [f, setF] = useState<LockerLocale>(esistente ? { ...esistente, conteggi: { ...vuoto.conteggi, ...esistente.conteggi } } : vuoto);
  function upd(patch: Partial<LockerLocale>) { setF((prev) => ({ ...prev, ...patch })); }
  function updConteggio(t: string, v: string) {
    setF((prev) => ({ ...prev, conteggi: { ...prev.conteggi, [t]: Math.max(0, Number(v) || 0) } }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.strutturaId) return;
    onSalva(f);
  }
  return (
    <Modal title={esistente ? "Modifica locale" : "Nuovo locale"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Sede"><select className={inputCls} value={f.strutturaId} onChange={(e) => upd({ strutturaId: e.target.value })}>{strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></Field>
        <Field label="Nome locale"><input required className={inputCls} value={f.nome} onChange={(e) => upd({ nome: e.target.value })} placeholder="Es. Reception, Deposito piano terraâ€¦" /></Field>
        <FieldGroup label="Locker installati per tipologia">
          <div className="grid gap-2">
            {TIPOLOGIE.map((t) => (
              <div key={t} className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-700">{t.split(" - ")[0]}</span>
                <input type="number" min="0" className={inputCls + " w-24 text-right"} value={f.conteggi[t] ?? 0} onChange={(e) => updConteggio(t, e.target.value)} />
              </div>
            ))}
          </div>
        </FieldGroup>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (<button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold"><Trash2 size={15} /> Elimina</button>) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1E8E6E] hover:bg-[#186f57] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
