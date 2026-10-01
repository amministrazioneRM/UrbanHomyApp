import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Luggage, LayoutGrid, Wallet, Plus, Pencil, Trash2, X, ArrowLeft,
  Settings, MapPin, Package, TrendingUp, Euro, ChevronDown, Clock3,
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

const PERIODI: Array<{ id: string; label: string; giorni: number | null }> = [
  { id: "7g", label: "Ultimi 7 giorni", giorni: 7 },
  { id: "30g", label: "Ultimo mese", giorni: 30 },
  { id: "tutto", label: "Tutto", giorni: null },
];

function incassato(o: LockerOrdine): number { return o.stato === "Concluso" ? o.prezzo : 0; }
function inAttesa(o: LockerOrdine): number { return o.stato === "InAttesaDiPagamento" ? o.prezzo : 0; }
function durataOre(o: LockerOrdine): number {
  const ini = new Date(o.inizio + "T" + o.oraInizio);
  const fin = new Date(o.fine + "T" + o.oraFine);
  return Math.max(0, (fin.getTime() - ini.getTime()) / 3600000);
}
function fmtEuro(n: number): string { return "€ " + (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtData(iso: string | undefined): string {
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
  inizio: ["inizio", "data inizio", "check in", "checkin", "start date", "data noleggio", "data deposito"],
  oraInizio: ["ora inizio", "ora check in", "start time", "ora deposito"],
  fine: ["fine", "data fine", "check out", "checkout", "end date", "data ritiro"],
  oraFine: ["ora fine", "ora check out", "end time", "ora ritiro"],
  prezzo: ["prezzo", "importo", "totale", "price", "amount", "totale eur", "prezzo eur", "incasso"],
  stato: ["stato", "status"],
  numArmadio: ["armadio", "n armadio", "numero armadio", "locker", "locker number", "box", "n box"],
  tipologia: ["tipologia", "tipo", "tipo box", "box type", "categoria", "taglia"],
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
    const oraOrdine = excelOraToHHMM(trovaCampo(norm, CAMPI_ALIAS.oraOrdine)) || "00:00";
    const inizioRaw = trovaCampo(norm, CAMPI_ALIAS.inizio);
    const fineRaw = trovaCampo(norm, CAMPI_ALIAS.fine);
    const inizio = inizioRaw ? excelDataToIso(inizioRaw) : dataOrdine;
    const fine = fineRaw ? excelDataToIso(fineRaw) : dataOrdine;
    const oraInizio = excelOraToHHMM(trovaCampo(norm, CAMPI_ALIAS.oraInizio)) || oraOrdine;
    const oraFine = excelOraToHHMM(trovaCampo(norm, CAMPI_ALIAS.oraFine)) || oraOrdine;

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
  const [ordini, setOrdini] = useSyncedResource<LockerOrdine>(api.ordini as never, seedOrdini);
  const [locali, setLocali] = useSyncedResource<LockerLocale>(api.locali as never, seedLocali);
  const [vendingStrutture] = useSyncedResource<VendingStruttura>(api.vendingStrutture as never, []);
  const [vendingVendite] = useSyncedResource<VendingVendita>(api.vendingVendite as never, []);
  const backendOffline = useBackendOffline();

  const [tab, setTab] = useState("dashboard");
  const TAB_IMPOSTAZIONI = ["sedi"];
  const [impostazioniAperte, setImpostazioniAperte] = useState(TAB_IMPOSTAZIONI.includes(tab));
  const [modale, setModale] = useState<ModaleState | null>(null);
  const [periodo, setPeriodo] = useState("tutto");
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
    if (dati.id) {
      setStrutture((ss) => ss.map((s) => (s.id === dati.id ? dati : s)));
    } else {
      setStrutture((ss) => [...ss, { ...dati, id: nid("LOC") }]);
    }
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

  async function importaOrdiniDaFile(file: File) {
    setImportRisultato({ loading: true });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const foglio = wb.Sheets[wb.SheetNames[0]];
      const righe = XLSX.utils.sheet_to_json(foglio, { defval: "" }) as Record<string, unknown>[];
      const { ordini: righeValide, scartati } = parseFoglioOrdini(righe, strutture);
      if (righeValide.length === 0) {
        setImportRisultato({ loading: false, errore: "Nessun ordine valido trovato nel file.", scartati });
        return;
      }
      const conferma = window.confirm(
        `Il file contiene ${righeValide.length} ordini validi. L'importazione sostituirà completamente l'elenco ordini attuale (${ordini.length} presenti ora) con quello del file. Continuare?`
      );
      if (!conferma) { setImportRisultato(null); return; }
      const mappa = new Map<string, LockerOrdine>();
      righeValide.forEach((o) => mappa.set(o.id, o));
      const nuovoElenco = Array.from(mappa.values());
      setOrdini(nuovoElenco);
      setImportRisultato({ loading: false, refresh: true, totaleImportati: nuovoElenco.length, scartati });
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
        <aside className="md:w-60 shrink-0 bg-[#1B2A26] text-stone-200 flex md:flex-col">
          <div className="px-5 py-5 border-b border-white/10 hidden md:block">
            <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3"><ArrowLeft size={12} /> Applicazioni Urban Homy</a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#1E8E6E] flex items-center justify-center"><Luggage size={16} className="text-white" /></div>
              <div>
                <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Baggy Locker</div>
                <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · incassi deposito bagagli</div>
              </div>
            </div>
          </div>
          <nav className="flex md:flex-col w-full px-2 py-3 gap-1 overflow-x-auto md:overflow-visible">
            <a href="/" className="md:hidden flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-stone-400 hover:text-stone-200 hover:bg-white/5 transition" title="Applicazioni Urban Homy"><ArrowLeft size={16} /></a>
            {([{ id: "dashboard", label: "Cruscotto", icon: LayoutGrid }, { id: "ordini", label: "Vendite", icon: Wallet }] as Array<{ id: string; label: string; icon: React.ComponentType<{ size?: number }> }>).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}`}>
                <t.icon size={16} />{t.label}
              </button>
            ))}
            {isAdminApp && (
              <div className="md:mt-1">
                <button onClick={() => setImpostazioniAperte((v) => !v)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${TAB_IMPOSTAZIONI.includes(tab) ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}`}>
                  <Settings size={16} />Impostazioni
                  <ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte ? "rotate-180" : ""}`} />
                </button>
                {impostazioniAperte && (
                  <div className="flex md:flex-col gap-1 md:mt-1 md:pl-4 md:border-l md:border-white/10 md:ml-4">
                    {([{ id: "sedi", label: "Sedi", icon: MapPin }] as Array<{ id: string; label: string; icon: React.ComponentType<{ size?: number }> }>).map((t) => (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}`}>
                        <t.icon size={15} />{t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
          <div className="px-5 py-3 text-[11px] text-stone-500 hidden md:block border-t border-white/10 mt-auto">
            {strutture.filter((s) => s.attiva).length} sedi attive · {ordini.length} ordini importati
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
          {tab === "dashboard" && <Dashboard ordini={ordini} ordiniPeriodo={ordiniPeriodo} vendingStrutture={vendingStrutture} vendingVendite={vendingVendite} strutture={strutture} periodo={periodo} setPeriodo={setPeriodo} strutturaOf={strutturaOf} onNuovo={() => setModale({ type: "nuovoOrdine", payload: null })} />}
          {tab === "ordini" && <Ordini ordini={ordini} strutture={strutture} strutturaOf={strutturaOf} onApri={(o) => setModale({ type: "modificaOrdine", payload: o })} onNuovo={() => setModale({ type: "nuovoOrdine", payload: null })} onImportaFile={importaOrdiniDaFile} importRisultato={importRisultato} onChiudiImport={() => setImportRisultato(null)} />}
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

  const giorniGrafico = useMemo(() => {
    const p = PERIODI.find((x) => x.id === periodo);
    if (p && p.giorni !== null) return p.giorni;
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
        arr.push({ key: inizioIso, label: fmtDataBreve(inizioIso), title: `${fmtData(inizioIso)} – ${fmtData(fineIso)}`, totale: tot, segmenti });
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
      const key = o.tipologia || "—";
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
          <h1 className="font-[Fraunces] text-2xl md:text-[28px] font-semibold text-stone-900">Cruscotto incassi</h1>
          <p className="text-stone-500 text-sm mt-1">Baggy Locker · Gruppo Urban Homy</p>
        </div>
        <button onClick={onNuovo} className="flex items-center gap-2 bg-[#1E8E6E] hover:bg-[#186f57] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"><Plus size={16} /> Nuovo ordine</button>
      </header>
      <div className="flex gap-2 mb-5">
        {PERIODI.map((p) => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${periodo === p.id ? "bg-[#1B2A26] text-white border-[#1B2A26]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Incasso totale" value={fmtEuro(stats.totaleIncasso)} sub={`${stats.ordiniConclusi} ordini conclusi`} icon={Euro} accent="bg-[#1B2A26]" />
        <StatCard label="Ordini conclusi" value={stats.ordiniConclusi} icon={Package} accent="bg-[#1E8E6E]" />
        <StatCard label="In attesa di pagamento" value={fmtEuro(stats.totaleAttesa)} sub={`${stats.nAttesa} ordini`} icon={Clock3} accent="bg-amber-500" />
        <StatCard label="Media per ordine" value={fmtEuro(stats.mediaPerOrdine)} sub={`durata media ${stats.durataMedia.toFixed(1)} h`} icon={Wallet} accent="bg-teal-600" />
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
            const tooltip = `${g.title} · ${fmtEuro(g.totale)}` + segmentiValidi.map((seg) => `\n${seg.nome}: ${fmtEuro(seg.valore)}`).join("");
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
              <div className="text-2xl font-bold text-stone-900 font-[Fraunces]">{fmtEuro(tot)}</div>
              <div className="text-xs text-stone-500 mt-1">{diSede.filter((o) => o.stato === "Concluso").length} ordini conclusi nel periodo selezionato</div>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-stone-100">
                <ShoppingCart size={12} className="text-stone-400 shrink-0" />
                <span className="text-sm font-semibold text-stone-700">{fmtEuro(totVendite)}</span>
                <span className="text-[11px] text-stone-400">vending machine · {venditeSede.length} vendite</span>
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
              const tooltip = `${t.tipologia} · ${fmtTipologia(valore)}` + segmentiValidi.map((seg) => `\n${seg.nome}: ${fmtTipologia(seg.valore)}`).join("");
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
  onImportaFile: (f: File) => void;
  importRisultato: ImportRisultato | null;
  onChiudiImport: () => void;
}

function Ordini({ ordini, strutture, strutturaOf, onApri, onNuovo, onImportaFile, importRisultato, onChiudiImport }: OrdiniProps) {
  const [filtroStruttura, setFiltroStruttura] = useState("");
  const [filtroStato, setFiltroStato] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("tutto");
  const [ricerca, setRicerca] = useState("");
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
    if (file && onImportaFile) onImportaFile(file);
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Vendite</h1>
          <p className="text-stone-500 text-sm mt-1">Elenco ordini del deposito bagagli</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileScelto} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importRisultato?.loading}
            className="flex items-center gap-2 bg-white border border-stone-300 hover:border-[#1E8E6E] text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50">
            <Upload size={16} /> {importRisultato?.loading ? "Importazione…" : "Importa da Excel"}
          </button>
          <button onClick={onNuovo} className="flex items-center gap-2 bg-[#1E8E6E] hover:bg-[#186f57] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"><Plus size={16} /> Nuovo ordine</button>
        </div>
      </header>
      {importRisultato && !importRisultato.loading && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${importRisultato.errore ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-emerald-50 border-emerald-300 text-emerald-800"}`}>
          <div className="flex items-start gap-2.5">
            {importRisultato.errore ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <div className="flex-1">
              {importRisultato.errore ? <div className="font-medium">{importRisultato.errore}</div> : (
                <>
                  <div className="font-medium">Elenco ordini aggiornato: {importRisultato.totaleImportati} ordini importati dal file{importRisultato.scartati && importRisultato.scartati.length > 0 && `, ${importRisultato.scartati.length} righe scartate`}.</div>
                  {importRisultato.scartati && importRisultato.scartati.length > 0 && (
                    <ul className="mt-1.5 text-xs text-emerald-700/80 list-disc list-inside space-y-0.5">
                      {importRisultato.scartati.slice(0, 8).map((s, i) => (<li key={i}>Riga {s.riga}: {s.motivo}</li>))}
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
      <div className="flex flex-wrap gap-2 mb-5 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <Search size={15} className="text-stone-400 shrink-0" />
          <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per codice ordine…" className="text-sm outline-none w-full bg-transparent" />
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
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{strutturaOf(o.strutturaId)?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{fmtData(o.dataOrdine)} · {o.oraOrdine}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap font-mono-tag">{o.oraInizio}–{o.oraFine}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{o.tipologia.split(" - ")[0]}</td>
                    <td className="px-4 py-3 text-stone-600">{o.numArmadio > 0 ? o.numArmadio : "—"}</td>
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
    </div>
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
          <Field label="N° armadio"><input type="number" min="0" className={inputCls} value={String(f.numArmadio)} onChange={(e) => upd({ numArmadio: e.target.value })} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prezzo (€)"><input required type="number" min="0" step="0.01" className={inputCls} value={String(f.prezzo)} onChange={(e) => upd({ prezzo: e.target.value })} placeholder="0.00" /></Field>
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
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Sedi</h1>
          <p className="text-stone-500 text-sm mt-1">Attiva una sede quando il servizio Baggy Locker parte davvero</p>
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
                  <div className="text-xs text-stone-500 mt-0.5">{citta} · {nOrdini} ordini registrati · {totaleLockerSede} locker censiti in {localiSede.length} local{localiSede.length === 1 ? "e" : "i"}</div>
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
                                <span key={t} className="text-[11px] font-mono-tag text-stone-500 bg-stone-100 rounded px-1.5 py-0.5">{t.split(" - ")[0]} × {l.conteggi[t]}</span>
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
            <option value="">Seleziona sede…</option>
            {sediCentrali.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.citta ? ` — ${s.citta}` : ""}</option>)}
          </select>
          <span className="text-xs text-stone-400 mt-1.5 block">Le sedi si gestiscono centralmente nell'app "Utenti e accessi" (Impostazioni → Sedi).</span>
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
        <Field label="Nome locale"><input required className={inputCls} value={f.nome} onChange={(e) => upd({ nome: e.target.value })} placeholder="Es. Reception, Deposito piano terra…" /></Field>
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
