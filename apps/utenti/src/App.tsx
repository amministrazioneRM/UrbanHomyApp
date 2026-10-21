import React, { useState } from "react";
import {
  ShieldCheck, Plus, Pencil, Trash2, X, ArrowLeft, Mail, Users, Grid3x3, Lock, Check, Copy, CalendarClock, Settings, ChevronDown, ChevronLeft, ChevronRight, MapPin, MapPinOff
} from "lucide-react";
import UHAccounts from "./accounts";
import { api, useSyncedResource } from "./api";
import type { AppId, UHAccount, UHRuolo, UHSostituto, UHSede, AccessiMap, PermessiMap } from "./accounts";

// ── Local draft types ──────────────────────────────────────────────────────────

interface AccountDraft {
  id: string | null;
  nome: string;
  email: string;
  password: string;
  ruoloGlobale: "Amministratore" | "Utente";
  accessi: AccessiMap;
  // null = tutte le sedi; string[] = solo le sedi elencate
  sediAbilitate: string[] | null;
}

interface RuoloDraft {
  id: string | null;
  appId: AppId;
  nome: string;
  bloccato?: boolean;
  permessi: PermessiMap;
}

interface SostitutoDraft {
  id: string | null;
  titolareId: string;
  appId: AppId;
  sostitutoId: string;
  dataInizio: string;
  dataFine: string;
  note: string;
}

interface SedeDraft {
  id: string | null;
  nome: string;
  tipo: string;
  citta: string;
  indirizzo: string;
  attiva: boolean;
}

// ── Modal state types ─────────────────────────────────────────────────────────

type ModaleUtente = { type: "nuovo" | "modifica"; payload: UHAccount | null };
type ModaleRuolo = {
  type: "nuovo" | "modifica";
  appId: AppId;
  payload: UHRuolo | null;
  prefill?: { nome: string; permessi: PermessiMap } | null;
};
type ModaleSede = { type: "nuovo" | "modifica"; payload: UHSede | null };
type ModaleSostituto = { type: "nuovo" | "modifica"; appId: AppId; payload: UHSostituto | null };

type Vista = "utenti" | "ruoli" | "sedi";

// ── Helpers ───────────────────────────────────────────────────────────────────

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

function formatDataIt(iso: string | undefined | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function statoSostituzione(sost: UHSostituto): { label: string; className: string } {
  const oggi = UHAccounts.oggiISO();
  if (oggi < sost.dataInizio) return { label: "Programmata", className: "bg-amber-50 text-amber-700 border-amber-300" };
  if (oggi > sost.dataFine) return { label: "Scaduta", className: "bg-stone-50 text-stone-400 border-stone-200" };
  return { label: "Attiva ora", className: "bg-emerald-50 text-emerald-700 border-emerald-300" };
}

// ── UI primitives ─────────────────────────────────────────────────────────────

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

function Tag({ children, className = "" }: TagProps): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      {children}
    </span>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps): JSX.Element {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

function Modal({ title, onClose, children, wide = false }: ModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/50 backdrop-blur-sm p-3 overflow-y-auto">
      <div className={`bg-[#FBF9F4] rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} my-6 border border-stone-200 flex flex-col max-h-[calc(100vh-3rem)]`}>
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

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#5B4B9E]/40 focus:border-[#5B4B9E]";

function ruoloBadge(ruolo: string | null): string {
  return ruolo === "Amministratore"
    ? "bg-[#5B4B9E]/10 text-[#5B4B9E] border-[#5B4B9E]/30"
    : "bg-stone-50 text-stone-500 border-stone-300";
}

function pillCls(attivo: boolean): string {
  return `px-3.5 py-1.5 rounded-full text-sm font-semibold border transition ${
    attivo
      ? "bg-[#241B3A] text-white border-[#241B3A]"
      : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"
  }`;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const [session] = useState<UHAccount | null>(() => UHAccounts.loadSession());
  const [accounts, setAccounts] = useSyncedResource(api.accounts, UHAccounts.loadAccounts());
  const [ruoli, setRuoli] = useSyncedResource(api.ruoli, UHAccounts.loadRoles());
  const [sostituti, setSostituti] = useSyncedResource(api.sostituti, UHAccounts.loadSostituti());
  const [sedi, setSedi] = useSyncedResource(api.sedi, UHAccounts.loadSedi());
  const [modale, setModale] = useState<ModaleUtente | null>(null);
  const [modaleRuolo, setModaleRuolo] = useState<ModaleRuolo | null>(null);
  const [modaleSede, setModaleSede] = useState<ModaleSede | null>(null);
  const [vista, setVista] = useState<Vista>("utenti");
  const [appRuoliSel, setAppRuoliSel] = useState<AppId>(UHAccounts.APPS[0].id);
  const TAB_IMPOSTAZIONI: Vista[] = ["ruoli", "sedi"];
  const [impostazioniAperte, setImpostazioniAperte] = useState<boolean>(TAB_IMPOSTAZIONI.includes(vista));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => { try { return localStorage.getItem("utenti-sidebar-collapsed") === "1"; } catch { return false; } });
  const toggleSidebar = () => setSidebarCollapsed((v) => { try { localStorage.setItem("utenti-sidebar-collapsed", v ? "0" : "1"); } catch {} return !v; });

  if (!session || !UHAccounts.isAdminGlobale(session)) {
    return (
      <div className="min-h-screen w-full bg-[#F3F0E8] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-[#241B3A] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={26} className="text-white" />
          </div>
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
          <p className="text-stone-500 text-sm mb-6">
            {session
              ? "Questa sezione è riservata agli amministratori del portale."
              : "Devi accedere dalla home page del portale per usare questa applicazione."}
          </p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#241B3A] hover:bg-[#1a1329] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
            <ArrowLeft size={15} /> Torna alla home
          </a>
        </div>
      </div>
    );
  }

  function persist(list: UHAccount[]): void {
    UHAccounts.saveAccounts(list);
    setAccounts(list);
  }
  function persistRuoli(list: UHRuolo[]): void {
    UHAccounts.saveRoles(list);
    setRuoli(list);
  }
  function persistSostituti(list: UHSostituto[]): void {
    UHAccounts.saveSostituti(list);
    setSostituti(list);
  }
  function persistSedi(list: UHSede[]): void {
    UHAccounts.saveSedi(list);
    setSedi(list);
  }

  function salva(dati: UHAccount): void {
    if (dati.id) {
      persist(accounts.map((a) => (a.id === dati.id ? dati : a)));
    } else {
      persist([{ ...dati, id: "ACC-" + Date.now() }, ...accounts]);
    }
    setModale(null);
  }
  function elimina(id: string): void {
    persist(accounts.filter((a) => a.id !== id));
    setModale(null);
  }

  function salvaRuolo(dati: RuoloDraft): void {
    if (dati.id) {
      persistRuoli(ruoli.map((r) => (r.id === dati.id ? { ...dati, id: dati.id } as UHRuolo : r)));
    } else {
      persistRuoli([{ ...dati, id: "RUOLO-" + Date.now(), bloccato: false } as UHRuolo, ...ruoli]);
    }
    setModaleRuolo(null);
  }
  function eliminaRuolo(id: string): void {
    const ruolo = ruoli.find((r) => r.id === id);
    if (!ruolo || ruolo.bloccato) return;
    const alternativa =
      ruoli.find((r) => r.appId === ruolo.appId && r.id !== id && r.nome === "Utente") ||
      ruoli.find((r) => r.appId === ruolo.appId && r.id !== id);
    persist(
      accounts.map((a) => {
        const acc = a.accessi && a.accessi[ruolo.appId];
        if (!acc || acc.ruoloId !== id) return a;
        return {
          ...a,
          accessi: {
            ...a.accessi,
            [ruolo.appId]: { abilitato: false, ruoloId: alternativa ? alternativa.id : acc.ruoloId },
          },
        };
      })
    );
    persistRuoli(ruoli.filter((r) => r.id !== id));
    setModaleRuolo(null);
  }
  function duplicaRuolo(ruolo: UHRuolo): void {
    setModaleRuolo({
      type: "nuovo",
      appId: ruolo.appId,
      payload: null,
      prefill: { nome: ruolo.nome + " (copia)", permessi: clone(ruolo.permessi) },
    });
  }

  function salvaSostituto(dati: UHSostituto): void {
    if (dati.id) {
      persistSostituti(sostituti.map((s) => (s.id === dati.id ? dati : s)));
    } else {
      persistSostituti([{ ...dati, id: "SOST-" + Date.now() }, ...sostituti]);
    }
  }
  function eliminaSostituto(id: string): void {
    persistSostituti(sostituti.filter((s) => s.id !== id));
  }

  function salvaSede(dati: UHSede): void {
    if (dati.id) {
      persistSedi(sedi.map((s) => (s.id === dati.id ? dati : s)));
    } else {
      persistSedi([{ ...dati, id: "SEDE-" + Date.now() }, ...sedi]);
    }
    setModaleSede(null);
  }
  function eliminaSede(id: string): void {
    persistSedi(sedi.filter((s) => s.id !== id));
    setModaleSede(null);
  }

  const appAttiva = UHAccounts.APPS.find((a) => a.id === appRuoliSel) || UHAccounts.APPS[0];
  const ruoliAppAttiva = ruoli.filter((r) => r.appId === appRuoliSel);

  return (
    <div className="min-h-screen w-full bg-[#F3F0E8] text-stone-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        .font-\\[Fraunces\\] { font-family: 'Fraunces', serif; }
      `}</style>

      <div className="flex flex-col md:flex-row min-h-screen">
        {/* SIDEBAR */}
        <aside className={`${sidebarCollapsed ? "md:w-14" : "md:w-60"} shrink-0 bg-[#241B3A] text-stone-200 flex md:flex-col md:sticky md:top-0 md:h-screen transition-all duration-200`}>
          <div className={`border-b border-white/10 hidden md:flex flex-col ${sidebarCollapsed ? "items-center px-0 py-4" : "px-5 py-5"}`}>
            {sidebarCollapsed && (
              <a href="/" className="flex items-center justify-center w-full py-2.5 rounded-lg hover:bg-white/5 transition mb-1" title="Torna alla home">
                <img src="data:image/png;base64,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" alt="Urban Homy Group" className="w-5 h-5 object-contain" />
              </a>
            )}
            {!sidebarCollapsed && (
              <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3">
                <ArrowLeft size={12} /> Applicazioni Urban Homy
              </a>
            )}
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div className="w-8 h-8 rounded-md bg-[#5B4B9E] flex items-center justify-center shrink-0">
                <ShieldCheck size={16} className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Utenti e accessi</div>
                  <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · utenti</div>
                </div>
              )}
            </div>
          </div>
          <nav className="flex md:flex-col w-full px-2 py-3 gap-1 overflow-x-auto md:overflow-y-auto md:flex-1 shrink-0">
            <a
              href="/"
              className="md:hidden flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap text-stone-400 hover:text-stone-200 hover:bg-white/5 transition"
              title="Applicazioni Urban Homy"
            >
              <ArrowLeft size={16} />
            </a>
            <button
              onClick={() => setVista("utenti")}
              title={sidebarCollapsed ? "Utenti" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${
                vista === "utenti" ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
              }`}
            >
              <Users size={16} />
              {!sidebarCollapsed && "Utenti"}
            </button>

            <div className="md:mt-1">
              <button
                onClick={() => setImpostazioniAperte((v) => !v)}
                title={sidebarCollapsed ? "Impostazioni" : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${
                  TAB_IMPOSTAZIONI.includes(vista) ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                }`}
              >
                <Settings size={16} />
                {!sidebarCollapsed && <>Impostazioni<ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte ? "rotate-180" : ""}`} /></>}
              </button>
              {!sidebarCollapsed && impostazioniAperte && (
                <div className="flex md:flex-col gap-1 md:mt-1 md:pl-4 md:border-l md:border-white/10 md:ml-4">
                  {(
                    [
                      { id: "ruoli" as Vista, label: "Ruoli e permessi", icon: Grid3x3 },
                      { id: "sedi" as Vista, label: "Sedi", icon: MapPin },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setVista(t.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        vista === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                      }`}
                    >
                      <t.icon size={15} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="hidden md:flex flex-col border-t border-white/10 mt-auto">
            {!sidebarCollapsed && (
              <div className="px-5 py-3 text-[11px] text-stone-500">
                {accounts.length} utenti · {ruoli.length} ruoli · {sedi.length} sedi
              </div>
            )}
            <button onClick={toggleSidebar} className="flex items-center justify-center py-2.5 text-stone-500 hover:text-stone-300 hover:bg-white/5 transition" title={sidebarCollapsed ? "Espandi menu" : "Comprimi menu"}>
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8">
          <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">
                {vista === "utenti" ? "Utenti" : vista === "ruoli" ? "Ruoli e permessi" : "Sedi"}
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                {vista === "utenti"
                  ? "Chi può accedere al portale e con quale ruolo, applicazione per applicazione"
                  : vista === "ruoli"
                    ? "Per ciascuna applicazione, i ruoli disponibili e i permessi per ciascun modulo"
                    : "Anagrafica delle sedi e strutture del gruppo, condivisa tra le applicazioni del portale"}
              </p>
            </div>
            {vista === "utenti" && (
              <button onClick={() => setModale({ type: "nuovo", payload: null })} className="flex items-center gap-2 bg-[#5B4B9E] hover:bg-[#493c80] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
                <Plus size={16} /> Nuovo utente
              </button>
            )}
            {vista === "ruoli" && (
              <button onClick={() => setModaleRuolo({ type: "nuovo", appId: appRuoliSel, payload: null })} className="flex items-center gap-2 bg-[#5B4B9E] hover:bg-[#493c80] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
                <Plus size={16} /> Nuovo ruolo
              </button>
            )}
            {vista === "sedi" && (
              <button onClick={() => setModaleSede({ type: "nuovo", payload: null })} className="flex items-center gap-2 bg-[#5B4B9E] hover:bg-[#493c80] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
                <Plus size={16} /> Nuova sede
              </button>
            )}
          </header>

          {vista === "utenti" && (
            <div className="grid gap-3">
              {accounts.map((a) => (
                <div key={a.id} className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-[#241B3A] text-white flex items-center justify-center font-[Fraunces] font-semibold shrink-0">
                    {a.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-stone-900">{a.nome}</span>
                      <Tag className={ruoloBadge(a.ruoloGlobale)}>{a.ruoloGlobale === "Amministratore" ? "Amministratore globale" : "Utente"}</Tag>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1"><Mail size={11} /> {a.email}</div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {UHAccounts.APPS.map((app) => {
                        const ha = UHAccounts.hasAccesso(a, app.id);
                        const ruolo = UHAccounts.ruoloIn(a, app.id);
                        return (
                          <Tag key={app.id} className={ha ? ruoloBadge(ruolo) : "bg-stone-50 text-stone-300 border-stone-200"}>
                            {app.nome}{ha ? ` · ${ruolo}` : " · nessun accesso"}
                          </Tag>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <MapPin size={11} className="text-stone-400 shrink-0" />
                      <span className="text-xs text-stone-500">
                        {!Array.isArray(a.sediAbilitate) || a.sediAbilitate == null
                          ? "Tutte le sedi"
                          : a.sediAbilitate.length === 0
                          ? "Nessuna sede"
                          : a.sediAbilitate.map((id) => sedi.find((s) => s.id === id)?.nome ?? id).join(", ")}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setModale({ type: "modifica", payload: a })} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0">
                    <Pencil size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {vista === "ruoli" && (
            <div>
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {UHAccounts.APPS.map((app) => (
                  <button key={app.id} onClick={() => setAppRuoliSel(app.id)} className={pillCls(appRuoliSel === app.id)}>
                    {app.nome}
                  </button>
                ))}
              </div>
              <p className="text-stone-500 text-sm mb-4">
                Ruoli disponibili per <span className="font-semibold text-stone-700">{appAttiva.nome}</span>: per ciascun modulo, i permessi di lettura, modifica, creazione ed eliminazione.
              </p>
              <div className="grid gap-4">
                {ruoliAppAttiva.map((ruolo) => (
                  <RuoloCard
                    key={ruolo.id}
                    ruolo={ruolo}
                    moduli={appAttiva.moduli}
                    onModifica={() => setModaleRuolo({ type: "modifica", appId: ruolo.appId, payload: ruolo })}
                    onElimina={() => eliminaRuolo(ruolo.id)}
                    onDuplica={() => duplicaRuolo(ruolo)}
                  />
                ))}
              </div>
            </div>
          )}

          {vista === "sedi" && (
            <div className="grid gap-3">
              {sedi.length === 0 && (
                <p className="text-center text-sm text-stone-400 bg-white border border-dashed border-stone-300 rounded-xl py-10">
                  Nessuna sede dichiarata. Usa "Nuova sede" per aggiungere la prima struttura del gruppo.
                </p>
              )}
              {sedi.map((sede) => (
                <SedeCard
                  key={sede.id}
                  sede={sede}
                  onModifica={() => setModaleSede({ type: "modifica", payload: sede })}
                  onElimina={() => eliminaSede(sede.id)}
                />
              ))}
            </div>
          )}

          <p className="text-center text-[11px] text-stone-400 mt-8">
            Ambiente dimostrativo — utenti, ruoli e password sono salvati solo nel browser (localStorage), condivisi tra le app del portale su questo dispositivo.
          </p>
        </main>
      </div>

      {(modale?.type === "nuovo" || modale?.type === "modifica") && (
        <UtenteForm
          esistente={modale.payload}
          ruoli={ruoli}
          accounts={accounts}
          sostituti={sostituti}
          sedi={sedi}
          onSalvaSostituto={salvaSostituto}
          onEliminaSostituto={eliminaSostituto}
          isProprioAccount={!!(modale.payload && session && modale.payload.id === session.id)}
          onSalva={salva}
          onElimina={modale.payload ? () => elimina(modale.payload!.id) : null}
          onClose={() => setModale(null)}
        />
      )}

      {(modaleRuolo?.type === "nuovo" || modaleRuolo?.type === "modifica") && (
        <RuoloForm
          esistente={modaleRuolo.payload}
          prefill={modaleRuolo.prefill ?? null}
          appId={modaleRuolo.appId}
          onSalva={salvaRuolo}
          onElimina={modaleRuolo.payload && !modaleRuolo.payload.bloccato ? () => eliminaRuolo(modaleRuolo.payload!.id) : null}
          onClose={() => setModaleRuolo(null)}
        />
      )}

      {(modaleSede?.type === "nuovo" || modaleSede?.type === "modifica") && (
        <SedeForm
          esistente={modaleSede.payload}
          onSalva={salvaSede}
          onElimina={modaleSede.payload ? () => eliminaSede(modaleSede.payload!.id) : null}
          onClose={() => setModaleSede(null)}
        />
      )}
    </div>
  );
}

// ── UtenteForm ────────────────────────────────────────────────────────────────

interface UtenteFormProps {
  esistente: UHAccount | null;
  ruoli: UHRuolo[];
  accounts: UHAccount[];
  sostituti: UHSostituto[];
  sedi: UHSede[];
  onSalvaSostituto: (dati: UHSostituto) => void;
  onEliminaSostituto: (id: string) => void;
  isProprioAccount: boolean;
  onSalva: (dati: UHAccount) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function UtenteForm({
  esistente, ruoli, accounts, sostituti, sedi,
  onSalvaSostituto, onEliminaSostituto, isProprioAccount,
  onSalva, onElimina, onClose,
}: UtenteFormProps): JSX.Element {
  const vuoto: AccountDraft = {
    id: null, nome: "", email: "", password: "", ruoloGlobale: "Utente",
    accessi: UHAccounts.accessoVuoto(),
    sediAbilitate: null,
  };
  const [f, setF] = useState<AccountDraft>(
    esistente
      ? {
          ...esistente,
          password: "",
          accessi: { ...UHAccounts.accessoVuoto(), ...esistente.accessi },
          sediAbilitate: esistente.sediAbilitate ?? null,
        }
      : vuoto
  );
  const [modaleSostituto, setModaleSostituto] = useState<ModaleSostituto | null>(null);

  function upd(patch: Partial<AccountDraft>): void { setF((prev) => ({ ...prev, ...patch })); }
  function updAccesso(appId: AppId, patch: Partial<{ abilitato: boolean; ruoloId: string }>): void {
    setF((prev) => ({
      ...prev,
      accessi: {
        ...prev.accessi,
        [appId]: { ...prev.accessi[appId], ...patch },
      },
    }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!f.nome.trim() || !f.email.trim() || (!esistente && !f.password)) return;
    const { password, ...senzaPassword } = f;
    const dati = password ? f : senzaPassword;
    // cast: id is guaranteed non-null for existing, or we set it in salva()
    onSalva(dati as UHAccount);
  }

  return (
    <Modal title={esistente ? "Modifica utente" : "Nuovo utente"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome e cognome">
          <input required className={inputCls} value={f.nome} onChange={(e) => upd({ nome: e.target.value })} placeholder="Es. Maria Conti" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input required type="email" className={inputCls} value={f.email} onChange={(e) => upd({ email: e.target.value })} placeholder="nome@urbanhomy.it" />
          </Field>
          <Field label={esistente ? "Nuova password (opzionale)" : "Password"}>
            <input required={!esistente} className={inputCls} value={f.password} onChange={(e) => upd({ password: e.target.value })} placeholder={esistente ? "Lascia vuoto per non cambiarla" : "••••••••"} />
          </Field>
        </div>

        <Field label="Ruolo globale">
          <select className={inputCls} value={f.ruoloGlobale} onChange={(e) => upd({ ruoloGlobale: e.target.value as "Amministratore" | "Utente" })}>
            {UHAccounts.RUOLI.map((r) => (
              <option key={r} value={r}>
                {r === "Amministratore" ? "Amministratore (accesso completo a tutte le app)" : "Utente (accesso solo alle app abilitate sotto)"}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-2 pt-3 border-t border-stone-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Sedi abilitate</div>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700 mb-2">
            <input
              type="checkbox"
              className="accent-[#5B4B9E]"
              checked={f.sediAbilitate === null}
              onChange={(e) => upd({ sediAbilitate: e.target.checked ? null : [] })}
            />
            Tutte le sedi
          </label>
          {f.sediAbilitate !== null && (
            <div className="grid gap-1 pl-1">
              {sedi.filter((s) => s.attiva).map((sede) => (
                <label key={sede.id} className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="accent-[#5B4B9E]"
                    checked={f.sediAbilitate!.includes(sede.id)}
                    onChange={(e) => {
                      const sel = f.sediAbilitate!;
                      upd({ sediAbilitate: e.target.checked ? [...sel, sede.id] : sel.filter((id) => id !== sede.id) });
                    }}
                  />
                  <MapPin size={12} className="text-stone-400 shrink-0" />
                  {sede.nome}
                  {sede.citta && <span className="text-stone-400 text-xs">· {sede.citta}</span>}
                </label>
              ))}
              {sedi.filter((s) => s.attiva).length === 0 && (
                <p className="text-xs text-stone-400">Nessuna sede attiva configurata.</p>
              )}
            </div>
          )}
        </div>

        {f.ruoloGlobale === "Utente" && (
          <div className="mt-2 pt-3 border-t border-stone-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Accesso per applicazione</div>
            <div className="grid gap-2">
              {UHAccounts.APPS.map((app) => {
                const ruoliApp = ruoli.filter((r) => r.appId === app.id);
                const sostitutiApp = f.id ? sostituti.filter((s) => s.titolareId === f.id && s.appId === app.id) : [];
                const accessoApp = f.accessi[app.id] ?? { abilitato: false, ruoloId: "" };
                return (
                  <div key={app.id} className="border border-stone-200 rounded-lg px-3.5 py-2.5">
                    <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
                      <input
                        type="checkbox"
                        className="accent-[#5B4B9E]"
                        checked={accessoApp.abilitato}
                        onChange={(e) => updAccesso(app.id, { abilitato: e.target.checked })}
                      />
                      {app.nome}
                    </label>
                    {accessoApp.abilitato && (
                      <>
                        <select
                          className={inputCls + " mt-2 text-xs"}
                          value={accessoApp.ruoloId}
                          onChange={(e) => updAccesso(app.id, { ruoloId: e.target.value })}
                        >
                          {ruoliApp.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                        </select>

                        <div className="mt-2.5 pt-2.5 border-t border-stone-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Sostituti</span>
                            {f.id && (
                              <button
                                type="button"
                                onClick={() => setModaleSostituto({ type: "nuovo", appId: app.id, payload: null })}
                                className="text-xs font-semibold text-[#5B4B9E] hover:text-[#493c80] flex items-center gap-1"
                              >
                                <Plus size={12} /> Aggiungi
                              </button>
                            )}
                          </div>
                          {!f.id && (
                            <p className="text-xs text-stone-400">Salva l'utente per poter assegnare sostituti.</p>
                          )}
                          {f.id && sostitutiApp.length === 0 && (
                            <p className="text-xs text-stone-400">Nessun sostituto per questa applicazione.</p>
                          )}
                          {sostitutiApp.map((s) => {
                            const stato = statoSostituzione(s);
                            const nomeSostituto = accounts.find((a) => a.id === s.sostitutoId)?.nome ?? "Utente eliminato";
                            return (
                              <div key={s.id} className="flex items-center justify-between gap-2 text-xs bg-stone-50 rounded-lg px-2.5 py-1.5 mb-1 last:mb-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  <span className="font-medium text-stone-700 truncate">{nomeSostituto}</span>
                                  <Tag className={stato.className}>{stato.label}</Tag>
                                  <span className="text-stone-400 whitespace-nowrap flex items-center gap-1">
                                    <CalendarClock size={11} /> {formatDataIt(s.dataInizio)}–{formatDataIt(s.dataFine)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button type="button" onClick={() => setModaleSostituto({ type: "modifica", appId: app.id, payload: s })} className="text-stone-400 hover:text-stone-700">
                                    <Pencil size={12} />
                                  </button>
                                  <button type="button" onClick={() => onEliminaSostituto(s.id)} className="text-stone-400 hover:text-rose-600">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isProprioAccount && f.ruoloGlobale !== "Amministratore" && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
            Stai rimuovendo il tuo ruolo di amministratore globale: dopo il salvataggio non potrai più accedere a questa sezione.
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
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#5B4B9E] hover:bg-[#493c80] text-white">Salva</button>
          </div>
        </div>
      </form>

      {(modaleSostituto?.type === "nuovo" || modaleSostituto?.type === "modifica") && (
        <SostitutoForm
          esistente={modaleSostituto.payload}
          titolareId={f.id ?? ""}
          titolareNome={f.nome}
          appId={modaleSostituto.appId}
          appNome={UHAccounts.APPS.find((a) => a.id === modaleSostituto.appId)?.nome}
          accounts={accounts}
          onSalva={(dati) => { onSalvaSostituto(dati); setModaleSostituto(null); }}
          onElimina={
            modaleSostituto.payload
              ? () => { onEliminaSostituto(modaleSostituto.payload!.id); setModaleSostituto(null); }
              : null
          }
          onClose={() => setModaleSostituto(null)}
        />
      )}
    </Modal>
  );
}

// ── RuoloCard ─────────────────────────────────────────────────────────────────

interface RuoloCardProps {
  ruolo: UHRuolo;
  moduli: { id: string; nome: string }[];
  onModifica: () => void;
  onElimina: () => void;
  onDuplica: () => void;
}

function RuoloCard({ ruolo, moduli, onModifica, onElimina, onDuplica }: RuoloCardProps): JSX.Element {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-[Fraunces] font-semibold text-stone-900">{ruolo.nome}</span>
          {ruolo.bloccato && (
            <Tag className="bg-stone-50 text-stone-500 border-stone-300"><Lock size={11} /> Ruolo predefinito</Tag>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!ruolo.bloccato && (
            <button onClick={onModifica} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" title="Modifica ruolo">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={onDuplica} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" title="Duplica ruolo">
            <Copy size={14} />
          </button>
          {!ruolo.bloccato && (
            <button onClick={onElimina} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" title="Elimina ruolo">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400 py-1.5 px-2">Modulo</th>
              {UHAccounts.PERMESSI.map((p) => (
                <th key={p.id} className="text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400 py-1.5 px-2">{p.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {moduli.map((m) => (
              <tr key={m.id} className="border-t border-stone-100">
                <td className="py-1.5 px-2 text-stone-700 whitespace-nowrap">{m.nome}</td>
                {UHAccounts.PERMESSI.map((p) => (
                  <td key={p.id} className="text-center py-1.5 px-2">
                    {ruolo.permessi[m.id]?.[p.id as keyof typeof ruolo.permessi[string]]
                      ? <Check size={14} className="inline text-emerald-600" />
                      : <span className="text-stone-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── RuoloForm ─────────────────────────────────────────────────────────────────

interface RuoloFormProps {
  esistente: UHRuolo | null;
  prefill: { nome: string; permessi: PermessiMap } | null | undefined;
  appId: AppId;
  onSalva: (dati: RuoloDraft) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function RuoloForm({ esistente, prefill, appId, onSalva, onElimina, onClose }: RuoloFormProps): JSX.Element {
  const vuoto: RuoloDraft = { id: null, appId, nome: "", permessi: UHAccounts.matricePermessi(appId, "vuoti") };
  const iniziale: RuoloDraft = esistente
    ? clone(esistente)
    : prefill
      ? { id: null, appId, bloccato: false, nome: prefill.nome, permessi: clone(prefill.permessi) }
      : vuoto;
  const [f, setF] = useState<RuoloDraft>(iniziale);
  const moduli = UHAccounts.moduliOf(appId);

  function togglePermesso(moduloId: string, tipo: string): void {
    setF((prev) => ({
      ...prev,
      permessi: {
        ...prev.permessi,
        [moduloId]: {
          ...prev.permessi[moduloId],
          [tipo]: !prev.permessi[moduloId]?.[tipo as keyof typeof prev.permessi[string]],
        },
      },
    }));
  }
  function toggleColonna(tipo: string): void {
    const tuttiAttivi = moduli.every((m) => f.permessi[m.id]?.[tipo as keyof typeof f.permessi[string]]);
    setF((prev) => {
      const nuovi = { ...prev.permessi };
      moduli.forEach((m) => {
        nuovi[m.id] = { ...nuovi[m.id], [tipo]: !tuttiAttivi };
      });
      return { ...prev, permessi: nuovi };
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!f.nome.trim()) return;
    onSalva(f);
  }

  return (
    <Modal title={esistente ? "Modifica ruolo" : prefill ? "Duplica ruolo" : "Nuovo ruolo"} onClose={onClose} wide>
      <form onSubmit={submit}>
        <Field label="Nome ruolo">
          <input required className={inputCls} value={f.nome} onChange={(e) => setF((p) => ({ ...p, nome: e.target.value }))} placeholder="Es. Receptionist, Tecnico esterno…" />
        </Field>

        <div className="mt-2 pt-3 border-t border-stone-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Permessi per modulo</div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-stone-500 py-2 px-2">Modulo</th>
                  {UHAccounts.PERMESSI.map((p) => (
                    <th key={p.id} className="text-center text-xs font-semibold text-stone-500 py-2 px-2">
                      <button type="button" onClick={() => toggleColonna(p.id)} className="hover:text-[#5B4B9E]" title={`Attiva/disattiva ${p.nome.toLowerCase()} su tutti i moduli`}>
                        {p.nome}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moduli.map((m) => (
                  <tr key={m.id} className="border-t border-stone-100">
                    <td className="py-2 px-2 font-medium text-stone-700 whitespace-nowrap">{m.nome}</td>
                    {UHAccounts.PERMESSI.map((p) => (
                      <td key={p.id} className="text-center py-2 px-2">
                        <input
                          type="checkbox"
                          className="accent-[#5B4B9E]"
                          checked={!!(f.permessi[m.id]?.[p.id as keyof typeof f.permessi[string]])}
                          onChange={() => togglePermesso(m.id, p.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#5B4B9E] hover:bg-[#493c80] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── SostitutoForm ─────────────────────────────────────────────────────────────

interface SostitutoFormProps {
  esistente: UHSostituto | null;
  titolareId: string;
  titolareNome: string;
  appId: AppId;
  appNome: string | undefined;
  accounts: UHAccount[];
  onSalva: (dati: UHSostituto) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function SostitutoForm({
  esistente, titolareId, titolareNome, appId, appNome, accounts, onSalva, onElimina, onClose,
}: SostitutoFormProps): JSX.Element {
  const oggi = UHAccounts.oggiISO();
  const vuoto: SostitutoDraft = { id: null, titolareId, appId, sostitutoId: "", dataInizio: oggi, dataFine: oggi, note: "" };
  const [f, setF] = useState<SostitutoDraft>(esistente ? clone(esistente) : vuoto);
  function upd(patch: Partial<SostitutoDraft>): void { setF((prev) => ({ ...prev, ...patch })); }

  const sostitutiDisponibili = accounts.filter((a) => a.id !== titolareId);

  const errore: string | null =
    !f.sostitutoId ? "Seleziona chi farà da sostituto."
    : f.dataFine < f.dataInizio ? "La data di fine non può precedere la data di inizio."
    : null;

  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (errore) return;
    onSalva(f as UHSostituto);
  }

  return (
    <Modal title={esistente ? "Modifica sostituto" : "Nuovo sostituto"} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="text-xs text-stone-500 -mt-1 mb-3">
          Sostituto di <span className="font-semibold text-stone-700">{titolareNome}</span> per <span className="font-semibold text-stone-700">{appNome}</span>
        </p>

        <Field label="Sostituto">
          <select required className={inputCls} value={f.sostitutoId} onChange={(e) => upd({ sostitutoId: e.target.value })}>
            <option value="">Seleziona utente…</option>
            {sostitutiDisponibili.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dal">
            <input required type="date" className={inputCls} value={f.dataInizio} onChange={(e) => upd({ dataInizio: e.target.value })} />
          </Field>
          <Field label="Al">
            <input required type="date" className={inputCls} value={f.dataFine} onChange={(e) => upd({ dataFine: e.target.value })} />
          </Field>
        </div>

        <Field label="Note (facoltativo)">
          <input className={inputCls} value={f.note} onChange={(e) => upd({ note: e.target.value })} placeholder="Es. Ferie, trasferta…" />
        </Field>

        {errore && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-300 rounded-lg px-3 py-2 mb-1">{errore}</div>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#5B4B9E] hover:bg-[#493c80] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── SedeCard ──────────────────────────────────────────────────────────────────

interface SedeCardProps {
  sede: UHSede;
  onModifica: () => void;
  onElimina: () => void;
}

function SedeCard({ sede, onModifica, onElimina }: SedeCardProps): JSX.Element {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${sede.attiva ? "bg-[#241B3A] text-white" : "bg-stone-100 text-stone-400"}`}>
        {sede.attiva ? <MapPin size={18} /> : <MapPinOff size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-stone-900">{sede.nome}</span>
          <Tag className="bg-stone-50 text-stone-500 border-stone-300">{sede.tipo}</Tag>
          {!sede.attiva && <Tag className="bg-rose-50 text-rose-600 border-rose-200">Non attiva</Tag>}
        </div>
        {(sede.citta || sede.indirizzo) && (
          <div className="text-xs text-stone-500 mt-0.5">
            {[sede.indirizzo, sede.citta].filter(Boolean).join(", ")}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onModifica} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" title="Modifica sede">
          <Pencil size={14} />
        </button>
        <button onClick={onElimina} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" title="Elimina sede">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── SedeForm ──────────────────────────────────────────────────────────────────

interface SedeFormProps {
  esistente: UHSede | null;
  onSalva: (dati: UHSede) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function SedeForm({ esistente, onSalva, onElimina, onClose }: SedeFormProps): JSX.Element {
  const vuoto: SedeDraft = { id: null, nome: "", tipo: UHAccounts.TIPI_SEDE[0], citta: "", indirizzo: "", attiva: true };
  const [f, setF] = useState<SedeDraft>(esistente ? clone(esistente) : vuoto);
  function upd(patch: Partial<SedeDraft>): void { setF((prev) => ({ ...prev, ...patch })); }

  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!f.nome.trim()) return;
    onSalva(f as UHSede);
  }

  return (
    <Modal title={esistente ? "Modifica sede" : "Nuova sede"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome">
          <input required className={inputCls} value={f.nome} onChange={(e) => upd({ nome: e.target.value })} placeholder="Es. Hotello Trieste" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo struttura">
            <select className={inputCls} value={f.tipo} onChange={(e) => upd({ tipo: e.target.value })}>
              {UHAccounts.TIPI_SEDE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Città">
            <input className={inputCls} value={f.citta} onChange={(e) => upd({ citta: e.target.value })} placeholder="Es. Trieste" />
          </Field>
        </div>

        <Field label="Indirizzo (facoltativo)">
          <input className={inputCls} value={f.indirizzo} onChange={(e) => upd({ indirizzo: e.target.value })} placeholder="Via, numero civico…" />
        </Field>

        <label className="flex items-center gap-2 text-sm font-medium text-stone-800 mb-1">
          <input type="checkbox" className="accent-[#5B4B9E]" checked={f.attiva} onChange={(e) => upd({ attiva: e.target.checked })} />
          Sede attiva
        </label>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#5B4B9E] hover:bg-[#493c80] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
