import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";

declare global {
  interface Window {
    __UH_API_BASE__?: string;
  }
}

const API_BASE = (typeof window !== "undefined" && window.__UH_API_BASE__) || "http://localhost:4000/api";

// Raggiungibilità del backend, condivisa da tutte le istanze di
// useSyncedResource: un'unica fonte di verità per mostrare un avviso quando
// le modifiche hanno smesso di essere salvate (vedi useBackendOffline sotto).
let backendOffline = false;
const offlineListeners = new Set<Dispatch<SetStateAction<boolean>>>();
function setBackendOffline(value: boolean): void {
  if (value === backendOffline) return;
  backendOffline = value;
  offlineListeners.forEach((fn) => fn(value));
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

interface Resource<T> {
  list: () => Promise<T[]>;
  create: (item: T) => Promise<T>;
  update: (id: string, item: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

type SyncedResourceReturn<T> = [T[], Dispatch<SetStateAction<T[]>>];

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...authHeaders() },
      ...options,
    });
  } catch (err) {
    // Fetch fallita a livello di rete (server giù, non raggiungibile, ecc.):
    // è l'unico caso da segnalare come "backend offline". Una risposta HTTP
    // di errore (400/500) significa invece che il server è raggiungibile.
    setBackendOffline(true);
    throw err;
  }
  setBackendOffline(false);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  if (res.status === 204) return null as unknown as T;
  return res.json() as Promise<T>;
}

function makeResource<T extends { id: string }>(path: string): Resource<T> {
  return {
    list: () => apiFetch<T[]>(`/${path}`),
    create: (item) => apiFetch<T>(`/${path}`, { method: "POST", body: JSON.stringify(item) }),
    update: (id, item) => apiFetch<T>(`/${path}/${id}`, { method: "PUT", body: JSON.stringify(item) }),
    remove: (id) => apiFetch<void>(`/${path}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  strutture: makeResource("vending/strutture"),
  macchine: makeResource("vending/macchine"),
  vendite: makeResource("vending/vendite"),
};

/**
 * Si comporta come useState, ma:
 * - al primo render carica i dati reali dal backend (mantenendo `seed`
 *   come contenuto provvisorio finché la richiesta non risponde);
 * - ad ogni modifica successiva dello state confronta l'array precedente
 *   con quello nuovo e replica le differenze (create/update/delete) verso
 *   l'API, cosicché i componenti esistenti continuino a chiamare setX(...)
 *   esattamente come prima, senza sapere che esiste un backend.
 * Se il backend non è raggiungibile l'app resta utilizzabile con i dati
 * locali, ma le modifiche non persistono.
 */
export function useSyncedResource<T extends { id: string }>(resource: Resource<T>, seed: T[]): SyncedResourceReturn<T> {
  const [items, setItems] = useState<T[]>(seed);
  const [loaded, setLoaded] = useState(false);
  const prevRef = useRef<T[]>(seed);

  useEffect(() => {
    let cancelled = false;
    resource
      .list()
      .then((data) => {
        if (cancelled) return;
        prevRef.current = data;
        setItems(data);
        setLoaded(true);
      })
      .catch((err: Error) => {
        console.warn("Backend non raggiungibile, uso i dati locali:", err.message);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const prev = prevRef.current;
    if (prev === items) return;

    const prevById = new Map(prev.map((it) => [it.id, it]));
    const nextById = new Map(items.map((it) => [it.id, it]));

    for (const [id, item] of nextById) {
      const before = prevById.get(id);
      if (!before) {
        resource.create(item).catch((err: Error) => console.error("Create fallita:", err));
      } else if (JSON.stringify(before) !== JSON.stringify(item)) {
        resource.update(id, item).catch((err: Error) => console.error("Update fallito:", err));
      }
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) {
        resource.remove(id).catch((err: Error) => console.error("Delete fallita:", err));
      }
    }
    prevRef.current = items;
  }, [items, loaded, resource]);

  return [items, setItems];
}
