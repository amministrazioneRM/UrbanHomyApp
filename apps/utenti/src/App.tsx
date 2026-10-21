import React, { useState } from "react";
import {
  ShieldCheck, Plus, Pencil, Trash2, X, ArrowLeft, Mail, Users, Grid3x3, Lock, Check, Copy, CalendarClock, Settings, ChevronDown, ChevronLeft, ChevronRight, MapPin, MapPinOff
} from "lucide-react";
import UHAccounts from "./accounts";
import { api, useSyncedResource } from "./api";
import type { AppId, UHAccount, UHRuolo, UHSostituto, UHSede, AccessiMap, PermessiMap } from "./accounts";

// â”€â”€ Local draft types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Modal state types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

function formatDataIt(iso: string | undefined | null): string {
  if (!iso) return "â€”";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function statoSostituzione(sost: UHSostituto): { label: string; className: string } {
  const oggi = UHAccounts.oggiISO();
  if (oggi < sost.dataInizio) return { label: "Programmata", className: "bg-amber-50 text-amber-700 border-amber-300" };
  if (oggi > sost.dataFine) return { label: "Scaduta", className: "bg-stone-50 text-stone-400 border-stone-200" };
  return { label: "Attiva ora", className: "bg-emerald-50 text-emerald-700 border-emerald-300" };
}

// â”€â”€ UI primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
              ? "Questa sezione Ã¨ riservata agli amministratori del portale."
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
              <a href="/" className="block mb-2">
                <img src="data:image/png;base64,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" alt="Urban Homy Group" className="w-8 h-8 object-contain" />
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
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center py-2.5 text-stone-500 hover:text-stone-300 hover:bg-white/5 transition"
              title={sidebarCollapsed ? "Espandi menu" : "Comprimi menu"}
            >
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
                  ? "Chi puÃ² accedere al portale e con quale ruolo, applicazione per applicazione"
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
                            {app.nome}{ha ? ` Â· ${ruolo}` : " Â· nessun accesso"}
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
            Ambiente dimostrativo â€” utenti, ruoli e password sono salvati solo nel browser (localStorage), condivisi tra le app del portale su questo dispositivo.
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

// â”€â”€ UtenteForm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            <input required={!esistente} className={inputCls} value={f.password} onChange={(e) => upd({ password: e.target.value })} placeholder={esistente ? "Lascia vuoto per non cambiarla" : "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"} />
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
                  {sede.citta && <span className="text-stone-400 text-xs">Â· {sede.citta}</span>}
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
                                    <CalendarClock size={11} /> {formatDataIt(s.dataInizio)}â€“{formatDataIt(s.dataFine)}
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
            Stai rimuovendo il tuo ruolo di amministratore globale: dopo il salvataggio non potrai piÃ¹ accedere a questa sezione.
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

// â”€â”€ RuoloCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                      : <span className="text-stone-300">â€”</span>}
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

// â”€â”€ RuoloForm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          <input required className={inputCls} value={f.nome} onChange={(e) => setF((p) => ({ ...p, nome: e.target.value }))} placeholder="Es. Receptionist, Tecnico esternoâ€¦" />
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

// â”€â”€ SostitutoForm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    !f.sostitutoId ? "Seleziona chi farÃ  da sostituto."
    : f.dataFine < f.dataInizio ? "La data di fine non puÃ² precedere la data di inizio."
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
            <option value="">Seleziona utenteâ€¦</option>
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
          <input className={inputCls} value={f.note} onChange={(e) => upd({ note: e.target.value })} placeholder="Es. Ferie, trasfertaâ€¦" />
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

// â”€â”€ SedeCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ SedeForm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          <Field label="CittÃ ">
            <input className={inputCls} value={f.citta} onChange={(e) => upd({ citta: e.target.value })} placeholder="Es. Trieste" />
          </Field>
        </div>

        <Field label="Indirizzo (facoltativo)">
          <input className={inputCls} value={f.indirizzo} onChange={(e) => upd({ indirizzo: e.target.value })} placeholder="Via, numero civicoâ€¦" />
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
