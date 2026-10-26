import { useEffect, useState, Dispatch, SetStateAction } from "react";

declare global {
  interface Window { __UH_API_BASE__?: string; }
}

const API_BASE = (typeof window !== "undefined" && window.__UH_API_BASE__) || "http://localhost:4000/api";

let backendOffline = false;
const offlineListeners = new Set<Dispatch<SetStateAction<boolean>>>();
function setBackendOffline(v: boolean) {
  if (v === backendOffline) return;
  backendOffline = v;
  offlineListeners.forEach((fn) => fn(v));
}
export function useBackendOffline(): boolean {
  const [offline, setOffline] = useState(backendOffline);
  useEffect(() => {
    offlineListeners.add(setOffline);
    return () => offlineListeners.delete(setOffline);
  }, []);
  return offline;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("uh_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  setBackendOffline(false);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastBU {
  id: string; nome: string; codiceBC?: string; sedeCentraleId: string;
  mewsPropertyId?: string; attiva: boolean;
}
export interface ForecastVoce { id: string; nome: string; ordine: number; attiva: boolean; tipiAttivita?: string[]; }
export interface TipoAttivitaBC { id: string; codice: string; nome: string; }
export interface ForecastEntry {
  id: string; buId: string; anno: number; mese: number; voceId: string;
  importo: number; stato: "bozza" | "pubblicato"; dataModifica: string; utenteId: string;
}
export interface ForecastTarget {
  id: string; buId: string; anno: number; mese: number; voceId: string; importo: number;
}
export interface ForecastStorico {
  id: string; buId: string; anno: number; mese: number; voceId: string;
  importo: number; dataRegistrazione: string; utenteId: string; tipo: "modifica" | "pubblicazione";
}
export interface ForecastActual {
  id: string; buId: string; anno: number; mese: number; voceId: string;
  importo: number; dataAggiornamento: string;
}
export interface DashboardData {
  entries: ForecastEntry[]; targets: ForecastTarget[]; actuals: ForecastActual[];
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const forecastApi = {
  // BU
  getBU: (tutte = false) => apiFetch<ForecastBU[]>(`/forecast/bu${tutte ? "?tutte=1" : ""}`),
  setBUAttiva: (id: string, attiva: boolean) =>
    apiFetch<ForecastBU>(`/forecast/bu/${id}/attiva`, { method: "PUT", body: JSON.stringify({ attiva }) }),
  getTipiAttivita: () => apiFetch<TipoAttivitaBC[]>("/forecast/tipi-attivita"),
  createBU: (data: Omit<ForecastBU, "id"> & { mewsClientToken?: string; mewsAccessToken?: string }) =>
    apiFetch<ForecastBU>("/forecast/bu", { method: "POST", body: JSON.stringify(data) }),
  updateBU: (id: string, data: Partial<ForecastBU> & { mewsClientToken?: string; mewsAccessToken?: string }) =>
    apiFetch<ForecastBU>(`/forecast/bu/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Voci
  getVoci: () => apiFetch<ForecastVoce[]>("/forecast/voci"),
  createVoce: (data: { nome: string; ordine?: number; tipiAttivita?: string[] }) =>
    apiFetch<ForecastVoce>("/forecast/voci", { method: "POST", body: JSON.stringify(data) }),
  updateVoce: (id: string, data: Partial<ForecastVoce>) =>
    apiFetch<ForecastVoce>(`/forecast/voci/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Entries
  getEntries: (params: { buId?: string; anno?: number; mese?: number }) => {
    const q = new URLSearchParams();
    if (params.buId) q.set("buId", params.buId);
    if (params.anno) q.set("anno", String(params.anno));
    if (params.mese) q.set("mese", String(params.mese));
    return apiFetch<ForecastEntry[]>(`/forecast/entries?${q}`);
  },
  saveEntries: (entries: Array<{ buId: string; anno: number; mese: number; voceId: string; importo: number }>, utenteId: string) =>
    apiFetch<ForecastEntry[]>("/forecast/entries", { method: "PUT", body: JSON.stringify({ entries, utenteId }) }),
  pubblicaEntries: (buId: string, anno: number, mese: number, utenteId: string) =>
    apiFetch<{ ok: boolean }>("/forecast/entries/pubblica", { method: "POST", body: JSON.stringify({ buId, anno, mese, utenteId }) }),

  // Targets
  getTargets: (params: { buId?: string; anno?: number }) => {
    const q = new URLSearchParams();
    if (params.buId) q.set("buId", params.buId);
    if (params.anno) q.set("anno", String(params.anno));
    return apiFetch<ForecastTarget[]>(`/forecast/targets?${q}`);
  },
  saveTargets: (targets: Array<{ buId: string; anno: number; mese: number; voceId: string; importo: number }>) =>
    apiFetch<ForecastTarget[]>("/forecast/targets", { method: "PUT", body: JSON.stringify({ targets }) }),

  // Storico
  getStorico: (params: { buId?: string; anno?: number; mese?: number }) => {
    const q = new URLSearchParams();
    if (params.buId) q.set("buId", params.buId);
    if (params.anno) q.set("anno", String(params.anno));
    if (params.mese) q.set("mese", String(params.mese));
    return apiFetch<ForecastStorico[]>(`/forecast/storico?${q}`);
  },

  // Actuals
  getActuals: (params: { buId?: string; anno?: number; mese?: number }) => {
    const q = new URLSearchParams();
    if (params.buId) q.set("buId", params.buId);
    if (params.anno) q.set("anno", String(params.anno));
    if (params.mese) q.set("mese", String(params.mese));
    return apiFetch<ForecastActual[]>(`/forecast/actuals?${q}`);
  },
  refreshActuals: (buId: string, anno: number, mese: number) =>
    apiFetch<ForecastActual[]>("/forecast/actuals/refresh", { method: "POST", body: JSON.stringify({ buId, anno, mese }) }),

  // Dashboard
  getDashboard: (params: { buId?: string; anno?: number }) => {
    const q = new URLSearchParams();
    if (params.buId) q.set("buId", params.buId);
    if (params.anno) q.set("anno", String(params.anno));
    return apiFetch<DashboardData>(`/forecast/dashboard?${q}`);
  },
};
