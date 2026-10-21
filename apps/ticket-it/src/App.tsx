import React, { useState, useMemo, useEffect } from "react";
import {
  LifeBuoy, Ticket as TicketIcon, Plus, ChevronDown, X, AlertTriangle,
  CheckCircle2, Clock3, Loader2, Trash2, Pencil, LayoutGrid, Search,
  Monitor, Package, Wifi, KeyRound, HelpCircle, Camera, Ban,
  Users, UserCog, Mail, Settings, Filter, ArrowLeft, Building2, UserCheck,
  ChevronLeft, ChevronRight
} from "lucide-react";
import type { UHAccount } from "./accounts";
import UHAccounts from "./accounts";
import { api, useSyncedResource, useBackendOffline } from "./api";

const APP_ID = "ticketIt";

/* ------------------------------------------------------------------ */
/*  DOMAIN INTERFACES                                                   */
/* ------------------------------------------------------------------ */

interface TicketStruttura {
  id: string;
  nome: string;
}

interface TicketUtente {
  id: string;
  nome: string;
  email: string;
  strutturaId: string;
  reparto: string;
}

interface Ticket {
  id: string;
  strutturaId: string;
  reparto: string;
  titolo: string;
  descrizione: string;
  categoria: string;
  priorita: string;
  stato: string;
  dataCreazione: string;
  scadenza: string;
  richiedente: string;
  note: string;
  foto: string[];
}

/* ------------------------------------------------------------------ */
/*  DATI DI PARTENZA â€” Gruppo Urban Homy                               */
/* ------------------------------------------------------------------ */

let _id = 1000;
const nid = (p: string): string => `${p}-${_id++}`;

const seedStrutture: TicketStruttura[] = [
  { id: "STR-1", nome: "Hotello Trieste" },
  { id: "STR-2", nome: "Hotello Padova" },
  { id: "STR-3", nome: "Urban Homy Gorizia" },
  { id: "STR-4", nome: "Europalace Hotel" },
  { id: "STR-5", nome: "Sede amministrativa" },
];

const REPARTI = ["Reception", "Amministrazione", "Direzione", "Housekeeping", "Ristorazione/Bar", "Manutenzione", "IT"] as const;

const seedUtenti: TicketUtente[] = [
  { id: "UTE-1", nome: "Maria Conti", email: "maria.c@urbanhomy.it", strutturaId: "STR-1", reparto: "Reception" },
  { id: "UTE-2", nome: "Davide Russo", email: "davide.r@urbanhomy.it", strutturaId: "STR-5", reparto: "Amministrazione" },
  { id: "UTE-3", nome: "Elena Fabris", email: "elena.f@urbanhomy.it", strutturaId: "STR-2", reparto: "Direzione" },
  { id: "UTE-4", nome: "Nicola Zanetti", email: "nicola.z@urbanhomy.it", strutturaId: "STR-3", reparto: "Reception" },
  { id: "UTE-5", nome: "Sara Bevilacqua", email: "sara.b@urbanhomy.it", strutturaId: "STR-4", reparto: "Housekeeping" },
  { id: "UTE-6", nome: "Luca Bortolussi", email: "luca.b@urbanhomy.it", strutturaId: "STR-1", reparto: "Ristorazione/Bar" },
];

const oggi = new Date();
const dPlus = (n: number): string => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const seedTicket: Ticket[] = [
  {
    id: "TIC-1", strutturaId: "STR-1", reparto: "Reception",
    titolo: "Stampante reception non stampa", descrizione: "La stampante degli scontrini si blocca dopo la prima pagina.",
    categoria: "Hardware", priorita: "Alta", stato: "Aperto",
    dataCreazione: dPlus(-1), scadenza: dPlus(1), richiedente: "Maria Conti", note: "", foto: [],
  },
  {
    id: "TIC-2", strutturaId: "STR-2", reparto: "Reception",
    titolo: "Gestionale prenotazioni non si connette", descrizione: "Il PMS perde la connessione internet piÃ¹ volte al giorno.",
    categoria: "Rete", priorita: "Urgente", stato: "In corso",
    dataCreazione: dPlus(-2), scadenza: dPlus(0), richiedente: "Elena Fabris", note: "Verifica router in corso con il fornitore.", foto: [],
  },
  {
    id: "TIC-3", strutturaId: "STR-5", reparto: "Amministrazione",
    titolo: "Nuovo account email per assunzione", descrizione: "Serve una casella email per il nuovo collega in amministrazione.",
    categoria: "Account", priorita: "Media", stato: "Aperto",
    dataCreazione: dPlus(-1), scadenza: dPlus(3), richiedente: "Davide Russo", note: "", foto: [],
  },
  {
    id: "TIC-4", strutturaId: "STR-3", reparto: "Reception",
    titolo: "PC reception si riavvia da solo", descrizione: "Il computer si riavvia improvvisamente durante il check-in.",
    categoria: "Hardware", priorita: "Alta", stato: "Aperto",
    dataCreazione: dPlus(-4), scadenza: dPlus(-1), richiedente: "Nicola Zanetti", note: "", foto: [],
  },
  {
    id: "TIC-5", strutturaId: "STR-4", reparto: "Reception",
    titolo: "Aggiornamento software gestionale cassa", descrizione: "Va installato l'ultimo aggiornamento del software di cassa.",
    categoria: "Software", priorita: "Bassa", stato: "Risolto",
    dataCreazione: dPlus(-8), scadenza: dPlus(-5), richiedente: "Sara Bevilacqua", note: "Aggiornato in remoto.", foto: [],
  },
  {
    id: "TIC-6", strutturaId: "STR-1", reparto: "Ristorazione/Bar",
    titolo: "Wifi ospiti lento", descrizione: "Gli ospiti segnalano una connessione wifi molto lenta in sala colazione.",
    categoria: "Rete", priorita: "Media", stato: "In corso",
    dataCreazione: dPlus(-3), scadenza: dPlus(5), richiedente: "Luca Bortolussi", note: "", foto: [],
  },
];

/* ------------------------------------------------------------------ */
/*  COSTANTI DI STILE                                                   */
/* ------------------------------------------------------------------ */

const PRIORITA = ["Bassa", "Media", "Alta", "Urgente"] as const;
const STATI = ["Aperto", "Presa in carico", "In corso", "Risolto", "Chiuso"] as const;
const CATEGORIE = ["Hardware", "Software", "Rete", "Account", "Altro"] as const;

const priColor: Record<string, string> = {
  Bassa: "bg-slate-100 text-slate-600 border-slate-300",
  Media: "bg-teal-50 text-teal-700 border-teal-300",
  Alta: "bg-amber-50 text-amber-800 border-amber-400",
  Urgente: "bg-rose-50 text-rose-700 border-rose-400",
};
const priDot: Record<string, string> = { Bassa: "bg-slate-400", Media: "bg-teal-500", Alta: "bg-amber-500", Urgente: "bg-rose-600" };

const statoColor: Record<string, string> = {
  "Aperto": "bg-slate-800 text-white",
  "Presa in carico": "bg-indigo-600 text-white",
  "In corso": "bg-teal-600 text-white",
  "Risolto": "bg-emerald-600 text-white",
  "Chiuso": "bg-stone-300 text-stone-600",
};
const statoIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "Aperto": Clock3,
  "Presa in carico": UserCheck,
  "In corso": Loader2,
  "Risolto": CheckCircle2,
  "Chiuso": Ban,
};

const categoriaIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Hardware: Monitor, Software: Package, Rete: Wifi, Account: KeyRound, Altro: HelpCircle
};

function fmtData(iso: string): string {
  if (!iso) return "â€”";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
function isScaduto(t: Ticket): boolean {
  return t.stato !== "Risolto" && t.stato !== "Chiuso" && t.scadenza < oggi.toISOString().slice(0, 10);
}

const FILTRO_RAPIDO_LABEL: Record<string, string> = { aperti: "Ticket aperti", urgenti: "Alta prioritÃ ", scaduti: "Scaduti", incorso: "In corso" };
function matchFiltroRapido(t: Ticket, tipo: string): boolean {
  switch (tipo) {
    case "aperti": return t.stato === "Aperto";
    case "urgenti": return (t.priorita === "Urgente" || t.priorita === "Alta") && t.stato !== "Risolto" && t.stato !== "Chiuso";
    case "scaduti": return isScaduto(t);
    case "incorso": return t.stato === "In corso";
    default: return true;
  }
}

/* ------------------------------------------------------------------ */
/*  COMPONENTI DI SUPPORTO                                              */
/* ------------------------------------------------------------------ */

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

function Tag({ children, className = "" }: TagProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      {children}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, accent, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-3 py-3 sm:px-5 sm:py-4 shadow-sm text-left ${
        onClick ? "cursor-pointer hover:border-[#2D6BC1]/50 hover:shadow-md transition" : ""
      }`}
    >
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-lg sm:text-2xl font-bold text-stone-900 leading-none font-[Fraunces] truncate">{value}</div>
        <div className="text-[10px] sm:text-xs text-stone-500 mt-1 tracking-wide uppercase">{label}</div>
      </div>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

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
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#2D6BC1]/40 focus:border-[#2D6BC1]";

/* ------------------------------------------------------------------ */
/*  MODALE TYPE                                                          */
/* ------------------------------------------------------------------ */

interface ModaleState {
  type: "nuovoTicket" | "modificaTicket" | "nuovoUtente" | "modificaUtente";
  payload: Ticket | TicketUtente | null;
}

interface FiltroRapidoState {
  tipo: string;
  token: number;
}

/* ------------------------------------------------------------------ */
/*  APP                                                                  */
/* ------------------------------------------------------------------ */

export default function App() {
  const [strutture] = useSyncedResource<TicketStruttura>(api.strutture, seedStrutture);
  const [utenti, setUtenti] = useSyncedResource<TicketUtente>(api.utenti, seedUtenti);
  const [ticket, setTicket] = useSyncedResource<Ticket>(api.ticket, seedTicket);
  const backendOffline = useBackendOffline();

  const [tab, setTab] = useState<string>("dashboard");
  const [utenteCorrenteId, setUtenteCorrenteId] = useState<string>(() => localStorage.getItem("uhit_utenteCorrenteId") || "");
  const TAB_IMPOSTAZIONI = ["utenti"];
  const [impostazioniAperte, setImpostazioniAperte] = useState<boolean>(TAB_IMPOSTAZIONI.includes(tab));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => { try { return localStorage.getItem("ticketit-sidebar-collapsed") === "1"; } catch { return false; } });
  const toggleSidebar = () => setSidebarCollapsed((v) => { try { localStorage.setItem("ticketit-sidebar-collapsed", v ? "0" : "1"); } catch {} return !v; });
  const [modale, setModale] = useState<ModaleState | null>(null);
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapidoState | null>(null);

  const [sessione] = useState<UHAccount | null>(() => UHAccounts.loadSession());
  const puoAccedere: boolean = UHAccounts.hasAccesso(sessione, APP_ID);
  const isAdminApp: boolean = UHAccounts.ruoloIn(sessione, APP_ID) === "Amministratore";

  useEffect(() => {
    if (!isAdminApp && TAB_IMPOSTAZIONI.includes(tab)) setTab("dashboard");
  }, [isAdminApp, tab]);

  function apriFiltroRapido(tipo: string) {
    setTab("ticket");
    setFiltroRapido({ tipo, token: Date.now() });
  }

  const strutturaOf = (id: string): TicketStruttura | undefined => strutture.find((s) => s.id === id);
  const luogoLabel = (t: Ticket): string => `${strutturaOf(t.strutturaId)?.nome ?? "â€”"} Â· ${t.reparto}`;

  /* -------- CRUD ticket -------- */
  function salvaTicket(dati: Ticket) {
    if (dati.id) {
      setTicket((ts) => ts.map((t) => (t.id === dati.id ? dati : t)));
    } else {
      setTicket((ts) => [{ ...dati, id: nid("TIC"), dataCreazione: oggi.toISOString().slice(0, 10) }, ...ts]);
    }
    setModale(null);
  }
  function eliminaTicket(id: string) {
    setTicket((ts) => ts.filter((t) => t.id !== id));
    setModale(null);
  }
  function cambiaStato(id: string, stato: string) {
    setTicket((ts) => ts.map((t) => (t.id === id ? { ...t, stato } : t)));
  }

  /* -------- CRUD utenti -------- */
  function salvaUtente(dati: TicketUtente) {
    if (dati.id) {
      setUtenti((us) => us.map((u) => (u.id === dati.id ? dati : u)));
    } else {
      setUtenti((us) => [{ ...dati, id: nid("UTE") }, ...us]);
    }
    setModale(null);
  }
  function eliminaUtente(id: string) {
    setUtenti((us) => us.filter((u) => u.id !== id));
    setModale(null);
  }

  const utenteCorrente: TicketUtente | null = utenti.find((u) => u.id === utenteCorrenteId) || null;

  /* -------- stats -------- */
  const stats = useMemo(() => {
    const aperti = ticket.filter((t) => t.stato === "Aperto").length;
    const urgenti = ticket.filter((t) => (t.priorita === "Urgente" || t.priorita === "Alta") && t.stato !== "Risolto" && t.stato !== "Chiuso").length;
    const scaduti = ticket.filter(isScaduto).length;
    const inCorso = ticket.filter((t) => t.stato === "In corso").length;
    return { aperti, urgenti, scaduti, inCorso };
  }, [ticket]);

  if (!puoAccedere) {
    return (
      <div className="min-h-screen w-full bg-[#F0F2F6] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-[#1B2340] flex items-center justify-center mx-auto mb-4">
            <LifeBuoy size={26} className="text-white" />
          </div>
          <h1 className="font-[Fraunces] text-xl md:text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
          <p className="text-stone-500 text-sm mb-6">
            {sessione
              ? "Il tuo account non ha accesso all'applicazione Ticket. Contatta un amministratore del portale."
              : "Devi accedere dalla home page del portale per usare questa applicazione."}
          </p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#1B2340] hover:bg-[#111827] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
            <ArrowLeft size={15} /> Torna alla home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F0F2F6] text-stone-800" style={{ fontFamily: "'Inter', sans-serif" }}>
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
        <aside className={`${sidebarCollapsed ? "md:w-14" : "md:w-60"} shrink-0 bg-[#1B2340] text-stone-200 flex md:flex-col md:sticky md:top-0 md:h-screen transition-all duration-200`}>
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
              <div className="w-8 h-8 rounded-md bg-[#2D6BC1] flex items-center justify-center shrink-0">
                <LifeBuoy size={16} className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Ticket</div>
                  <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · assistenza IT</div>
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
            {[
              { id: "dashboard", label: "Cruscotto", icon: LayoutGrid },
              { id: "ticket", label: "Ticket", icon: TicketIcon },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={sidebarCollapsed ? t.label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${
                  tab === t.id ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                }`}
              >
                <t.icon size={16} />
                {!sidebarCollapsed && t.label}
              </button>
            ))}

            {isAdminApp && (
            <div className="md:mt-1">
              <button
                onClick={() => setImpostazioniAperte((v) => !v)}
                title={sidebarCollapsed ? "Impostazioni" : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${
                  TAB_IMPOSTAZIONI.includes(tab) ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                }`}
              >
                <Settings size={16} />
                {!sidebarCollapsed && <>Impostazioni<ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte ? "rotate-180" : ""}`} /></>}
              </button>
              {!sidebarCollapsed && impostazioniAperte && (
                <div className="flex md:flex-col gap-1 md:mt-1 md:pl-4 md:border-l md:border-white/10 md:ml-4">
                  {[{ id: "utenti", label: "Utenti", icon: Users }].map((t) => (
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
          {!sidebarCollapsed && (
          <div className="mt-auto px-3 py-3 border-t border-white/10">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 px-2 mb-1.5">Accesso come</div>
            <select
              value={utenteCorrenteId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setUtenteCorrenteId(e.target.value);
                localStorage.setItem("uhit_utenteCorrenteId", e.target.value);
              }}
              className="w-full bg-white/10 text-stone-100 text-xs rounded-lg px-2.5 py-2 outline-none border border-white/10 focus:border-[#2D6BC1]"
            >
              <option value="" className="text-stone-800">Amministratore (vede tutto)</option>
              {utenti.map((u) => <option key={u.id} value={u.id} className="text-stone-800">{u.nome}</option>)}
            </select>
          </div>
          )}
          <div className="hidden md:flex flex-col border-t border-white/10 mt-auto">
            {!sidebarCollapsed && (
              <div className="px-5 py-3 text-[11px] text-stone-500">
                {strutture.length} sedi · {utenti.length} utenti
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
          {tab === "dashboard" && (
            <Dashboard
              stats={stats}
              ticket={ticket}
              luogoLabel={luogoLabel}
              onApri={(t) => setModale({ type: "modificaTicket", payload: t })}
              onNuovo={() => setModale({ type: "nuovoTicket", payload: null })}
              onFiltroRapido={apriFiltroRapido}
            />
          )}

          {tab === "ticket" && (
            <TicketList
              ticket={ticket}
              filtroRapido={filtroRapido}
              strutture={strutture}
              utenti={utenti}
              utenteCorrente={utenteCorrente}
              luogoLabel={luogoLabel}
              cambiaStato={cambiaStato}
              onApri={(t) => setModale({ type: "modificaTicket", payload: t })}
              onNuovo={() => setModale({ type: "nuovoTicket", payload: null })}
            />
          )}

          {tab === "utenti" && (
            <Utenti
              utenti={utenti}
              strutture={strutture}
              ticket={ticket}
              onNuovo={() => setModale({ type: "nuovoUtente", payload: null })}
              onApri={(u) => setModale({ type: "modificaUtente", payload: u })}
            />
          )}
        </main>
      </div>

      {(modale?.type === "nuovoTicket" || modale?.type === "modificaTicket") && (
        <TicketForm
          esistente={modale.payload as Ticket | null}
          strutture={strutture}
          utenti={utenti}
          utenteCorrente={utenteCorrente}
          onSalva={salvaTicket}
          onElimina={modale.payload ? () => eliminaTicket((modale.payload as Ticket).id) : null}
          onClose={() => setModale(null)}
        />
      )}

      {(modale?.type === "nuovoUtente" || modale?.type === "modificaUtente") && (
        <UtenteForm
          esistente={modale.payload as TicketUtente | null}
          strutture={strutture}
          onSalva={salvaUtente}
          onElimina={modale.payload ? () => eliminaUtente((modale.payload as TicketUtente).id) : null}
          onClose={() => setModale(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                           */
/* ------------------------------------------------------------------ */

interface DashboardProps {
  stats: { aperti: number; urgenti: number; scaduti: number; inCorso: number };
  ticket: Ticket[];
  luogoLabel: (t: Ticket) => string;
  onApri: (t: Ticket) => void;
  onNuovo: () => void;
  onFiltroRapido: (tipo: string) => void;
}

function Dashboard({ stats, ticket, luogoLabel, onApri, onNuovo, onFiltroRapido }: DashboardProps) {
  const inScadenza = ticket
    .filter((t) => t.stato !== "Risolto" && t.stato !== "Chiuso")
    .slice()
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
    .slice(0, 6);

  return (
    <div>
      <header className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-xl md:text-[28px] font-semibold text-stone-900">Cruscotto ticket IT</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">Gruppo Urban Homy Â· tutte le sedi</p>
        </div>
        <button onClick={onNuovo} className="flex items-center gap-2 bg-[#2D6BC1] hover:bg-[#25569c] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo ticket
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ticket aperti" value={stats.aperti} icon={TicketIcon} accent="bg-[#1B2340]" onClick={() => onFiltroRapido("aperti")} />
        <StatCard label="Alta prioritÃ " value={stats.urgenti} icon={AlertTriangle} accent="bg-[#2D6BC1]" onClick={() => onFiltroRapido("urgenti")} />
        <StatCard label="Scaduti" value={stats.scaduti} icon={Clock3} accent="bg-rose-600" onClick={() => onFiltroRapido("scaduti")} />
        <StatCard label="In corso" value={stats.inCorso} icon={Loader2} accent="bg-teal-600" onClick={() => onFiltroRapido("incorso")} />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-[Fraunces] font-semibold text-stone-900">Prossime scadenze</h2>
          <span className="text-xs text-stone-400">ordinate per scadenza</span>
        </div>
        <ul className="divide-y divide-stone-100">
          {inScadenza.length === 0 && <li className="px-5 py-6 text-sm text-stone-400">Nessun ticket aperto. Tutto sotto controllo.</li>}
          {inScadenza.map((t) => {
            const scaduto = isScaduto(t);
            const StatoIcon = statoIcon[t.stato];
            const CategoriaIcon = categoriaIcon[t.categoria];
            return (
              <li key={t.id} onClick={() => onApri(t)} className="px-5 py-3.5 flex items-center gap-4 hover:bg-stone-50 cursor-pointer transition">
                <span className={`w-2 h-2 rounded-full ${priDot[t.priorita]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-900 truncate">{t.titolo}</span>
                    <CategoriaIcon size={12} className="text-stone-400 shrink-0" />
                  </div>
                  <div className="text-xs text-stone-500 truncate">{luogoLabel(t)}</div>
                </div>
                <span className={`text-xs font-mono-tag ${scaduto ? "text-rose-600 font-semibold" : "text-stone-500"}`}>{fmtData(t.scadenza)}</span>
                <Tag className={statoColor[t.stato] + " border-transparent"}>
                  <StatoIcon size={11} /> {t.stato}
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
/*  ELENCO TICKET                                                       */
/* ------------------------------------------------------------------ */

interface TicketListProps {
  ticket: Ticket[];
  filtroRapido: FiltroRapidoState | null;
  strutture: TicketStruttura[];
  utenti: TicketUtente[];
  utenteCorrente: TicketUtente | null;
  luogoLabel: (t: Ticket) => string;
  cambiaStato: (id: string, stato: string) => void;
  onApri: (t: Ticket) => void;
  onNuovo: () => void;
}

function TicketList({ ticket, filtroRapido, strutture, utenti, utenteCorrente, luogoLabel, cambiaStato, onApri, onNuovo }: TicketListProps) {
  const [filtroStruttura, setFiltroStruttura] = useState<string>("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [filtroStato, setFiltroStato] = useState<string>("");
  const [filtroRichiedente, setFiltroRichiedente] = useState<string>("");
  const [ricerca, setRicerca] = useState<string>("");
  const [filtroRapidoAttivo, setFiltroRapidoAttivo] = useState<FiltroRapidoState | null>(filtroRapido);

  useEffect(() => {
    if (filtroRapido) setFiltroRapidoAttivo(filtroRapido);
  }, [filtroRapido]);

  const vista = utenteCorrente ? (filtroRichiedente === utenteCorrente.nome ? "miei" : "tutti") : "tutti";
  function impostaVista(v: string) {
    setFiltroRichiedente(v === "miei" && utenteCorrente ? utenteCorrente.nome : "");
  }

  const nomiRichiedenti = useMemo(() => {
    return Array.from(new Set(ticket.map((t) => t.richiedente).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [ticket]);

  const elenco = ticket
    .filter((t) => !filtroRapidoAttivo || matchFiltroRapido(t, filtroRapidoAttivo.tipo))
    .filter((t) => !filtroStruttura || t.strutturaId === filtroStruttura)
    .filter((t) => !filtroCategoria || t.categoria === filtroCategoria)
    .filter((t) => !filtroStato || t.stato === filtroStato)
    .filter((t) => !filtroRichiedente || t.richiedente === filtroRichiedente)
    .filter((t) => !ricerca || (t.titolo + t.descrizione).toLowerCase().includes(ricerca.toLowerCase()))
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));

  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-xl md:text-2xl font-semibold text-stone-900">Ticket</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">
            {utenteCorrente ? <>Connesso come <span className="font-semibold text-stone-700">{utenteCorrente.nome}</span> Â· {utenteCorrente.reparto}</> : "Richieste di assistenza IT del gruppo"}
          </p>
        </div>
        <button onClick={onNuovo} className="flex items-center gap-2 bg-[#2D6BC1] hover:bg-[#25569c] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo ticket
        </button>
      </header>

      {filtroRapidoAttivo && (
        <div className="flex items-center gap-2 mb-4 bg-[#1B2340]/5 border border-[#1B2340]/20 text-stone-700 text-xs font-medium rounded-lg px-3.5 py-2.5">
          <Filter size={14} className="shrink-0 text-[#1B2340]" />
          Filtro rapido dal cruscotto: <span className="font-semibold">{FILTRO_RAPIDO_LABEL[filtroRapidoAttivo.tipo]}</span>
          <button onClick={() => setFiltroRapidoAttivo(null)} className="ml-auto flex items-center gap-1 text-stone-500 hover:text-stone-800">
            <X size={13} /> Rimuovi
          </button>
        </div>
      )}

      {utenteCorrente ? (
        <div className="flex gap-2 mb-4">
          {[
            { id: "tutti", label: "Tutti i ticket" },
            { id: "miei", label: "I miei ticket" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => impostaVista(v.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
                vista === v.id ? "bg-[#1B2340] text-white border-[#1B2340]" : "bg-white text-stone-500 border-stone-300 hover:border-stone-400"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-stone-400 mb-4 flex items-center gap-1.5">
          <UserCog size={13} /> Seleziona "Accesso come" nella barra laterale per vedere rapidamente solo i tuoi ticket.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <Search size={15} className="text-stone-400 shrink-0" />
          <input value={ricerca} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRicerca(e.target.value)} placeholder="Cerca per titolo o descrizioneâ€¦" className="text-sm outline-none w-full bg-transparent" />
        </div>
        <select value={filtroStruttura} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltroStruttura(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutte le sedi</option>
          {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filtroCategoria} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltroCategoria(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutte le categorie</option>
          {CATEGORIE.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtroStato} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltroStato(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti gli stati</option>
          {STATI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroRichiedente} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltroRichiedente(e.target.value)} className={inputCls + " w-auto text-xs"}>
          <option value="">Tutti i richiedenti</option>
          {nomiRichiedenti.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
      </div>

      <div className="grid gap-3">
        {elenco.length === 0 && (
          <div className="text-center py-14 text-stone-400 text-sm bg-white border border-dashed border-stone-300 rounded-xl">
            Nessun ticket corrisponde ai filtri selezionati.
          </div>
        )}
        {elenco.map((t) => {
          const CategoriaIcon = categoriaIcon[t.categoria];
          const scaduto = isScaduto(t);
          return (
            <div key={t.id} className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
              <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => onApri(t)}>
                <div className="mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#2D6BC1]/10 text-[#2D6BC1]">
                  <CategoriaIcon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-stone-900">{t.titolo}</span>
                    <Tag className={priColor[t.priorita]}>{t.priorita}</Tag>
                    {scaduto && <Tag className="bg-rose-600 text-white border-transparent">In ritardo</Tag>}
                    {t.foto?.length > 0 && <Tag className="bg-stone-50 text-stone-500 border-stone-300"><Camera size={10} /> {t.foto.length}</Tag>}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(t)} Â· richiesto da {t.richiedente || "â€”"}</div>
                  <div className="text-xs text-stone-400 mt-1 font-mono-tag">{t.id} Â· scadenza {fmtData(t.scadenza)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={t.stato}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => cambiaStato(t.id, e.target.value)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer ${statoColor[t.stato]}`}
                >
                  {STATI.map((s) => <option key={s} value={s} className="bg-white text-stone-800">{s}</option>)}
                </select>
                <button onClick={() => onApri(t)} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500">
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
/*  FORM TICKET                                                         */
/* ------------------------------------------------------------------ */

interface TicketFormProps {
  esistente: Ticket | null;
  strutture: TicketStruttura[];
  utenti: TicketUtente[];
  utenteCorrente: TicketUtente | null;
  onSalva: (dati: Ticket) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function TicketForm({ esistente, strutture, utenti, utenteCorrente, onSalva, onElimina, onClose }: TicketFormProps) {
  const vuoto: Ticket = {
    id: "", strutturaId: strutture[0]?.id ?? "", reparto: REPARTI[0],
    titolo: "", descrizione: "", categoria: "Hardware", priorita: "Media", stato: "Aperto",
    scadenza: oggi.toISOString().slice(0, 10), richiedente: "", note: "", foto: [],
    dataCreazione: "",
  };
  const iniziale: Ticket = esistente ? { ...esistente, foto: esistente.foto || [] } : vuoto;
  const [f, setF] = useState<Ticket>(iniziale);
  const [caricamento, setCaricamento] = useState<boolean>(false);

  function upd(patch: Partial<Ticket>) { setF((prev) => ({ ...prev, ...patch })); }

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
  function rimuoviFoto(idx: number) {
    setF((prev) => ({ ...prev, foto: prev.foto.filter((_, i) => i !== idx) }));
  }

  function prendiInCarico() {
    upd({ stato: "Presa in carico" });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!f.titolo.trim()) return;
    onSalva(f);
  }

  return (
    <Modal title={esistente ? "Modifica ticket" : "Nuovo ticket IT"} onClose={onClose} wide>
      <form onSubmit={submit}>
        <Field label="Titolo">
          <input required className={inputCls} value={f.titolo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd({ titolo: e.target.value })} placeholder="Es. Stampante reception non funziona" />
        </Field>

        <Field label="Descrizione">
          <textarea className={inputCls} rows={2} value={f.descrizione} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => upd({ descrizione: e.target.value })} placeholder="Dettagli del problema riscontrato" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sede">
            <select className={inputCls} value={f.strutturaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ strutturaId: e.target.value })}>
              {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          <Field label="Reparto">
            <select className={inputCls} value={f.reparto} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ reparto: e.target.value })}>
              {REPARTI.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select className={inputCls} value={f.categoria} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ categoria: e.target.value })}>
              {CATEGORIE.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="PrioritÃ ">
            <select className={inputCls} value={f.priorita} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ priorita: e.target.value })}>
              {PRIORITA.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stato">
            <select className={inputCls} value={f.stato} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ stato: e.target.value })}>
              {STATI.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Scadenza">
            <input type="date" className={inputCls} value={f.scadenza} onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd({ scadenza: e.target.value })} />
          </Field>
        </div>

        {esistente && f.stato === "Aperto" && (
          <button
            type="button"
            onClick={prendiInCarico}
            className="w-full flex items-center justify-center gap-2 mb-4 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            <UserCheck size={16} />
            {utenteCorrente ? `Prendi in carico come ${utenteCorrente.nome}` : "Prendi in carico"}
          </button>
        )}

        <Field label="Richiedente">
          <select
            className={inputCls}
            value={f.richiedente === "" ? "" : (utenti.some((u) => u.nome === f.richiedente) ? f.richiedente : "__altro__")}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ richiedente: e.target.value === "__altro__" ? "altro:" : e.target.value })}
          >
            <option value="">â€” non specificato â€”</option>
            {utenti.map((u) => <option key={u.id} value={u.nome}>{u.nome} Â· {u.reparto}</option>)}
            <option value="__altro__">Altro (inserisci manualmente)â€¦</option>
          </select>
          {f.richiedente !== "" && !utenti.some((u) => u.nome === f.richiedente) && (
            <input
              className={inputCls + " mt-1.5"}
              value={f.richiedente === "altro:" ? "" : f.richiedente}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd({ richiedente: e.target.value })}
              placeholder="Nome richiedente"
              autoFocus
            />
          )}
        </Field>

        <Field label="Foto / allegati">
          <div className="flex flex-wrap gap-2">
            {f.foto.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-stone-200" />
                <button type="button" onClick={() => rimuoviFoto(i)} className="absolute -top-1.5 -right-1.5 bg-stone-800 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  <X size={11} />
                </button>
              </div>
            ))}
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center cursor-pointer text-stone-400 hover:border-[#2D6BC1] hover:text-[#2D6BC1] transition">
              <Camera size={18} />
              <input type="file" accept="image/*" multiple className="hidden" onChange={aggiungiFoto} />
            </label>
          </div>
          {caricamento && <div className="text-xs text-stone-400 mt-1.5">Caricamento in corsoâ€¦</div>}
        </Field>

        <Field label="Note">
          <textarea className={inputCls} rows={2} value={f.note} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => upd({ note: e.target.value })} placeholder="Note interne, soluzione applicata, ecc." />
        </Field>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#2D6BC1] hover:bg-[#25569c] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  UTENTI                                                              */
/* ------------------------------------------------------------------ */

interface UtentiProps {
  utenti: TicketUtente[];
  strutture: TicketStruttura[];
  ticket: Ticket[];
  onNuovo: () => void;
  onApri: (u: TicketUtente) => void;
}

function Utenti({ utenti, strutture, ticket, onNuovo, onApri }: UtentiProps) {
  const strutturaOf = (id: string): TicketStruttura | undefined => strutture.find((s) => s.id === id);
  return (
    <div>
      <header className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-[Fraunces] text-xl md:text-2xl font-semibold text-stone-900">Utenti</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-1">Personale che puÃ² aprire ticket di assistenza IT</p>
        </div>
        <button onClick={onNuovo} className="flex items-center gap-2 bg-[#2D6BC1] hover:bg-[#25569c] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo utente
        </button>
      </header>

      <div className="grid gap-3">
        {utenti.map((u) => {
          const nTicket = ticket.filter((t) => t.richiedente === u.nome).length;
          return (
            <div key={u.id} onClick={() => onApri(u)} className="bg-white border border-stone-200 rounded-xl shadow-sm px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-[#2D6BC1]/50 transition">
              <div className="w-10 h-10 rounded-full bg-[#1B2340] text-white flex items-center justify-center font-[Fraunces] font-semibold shrink-0">
                {u.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-stone-900">{u.nome}</div>
                <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><Mail size={11} /> {u.email}</span>
                  <span className="flex items-center gap-1"><Building2 size={11} /> {strutturaOf(u.strutturaId)?.nome ?? "â€”"} Â· {u.reparto}</span>
                </div>
              </div>
              <Tag className="bg-stone-50 text-stone-500 border-stone-300"><TicketIcon size={10} /> {nTicket} ticket</Tag>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface UtenteFormProps {
  esistente: TicketUtente | null;
  strutture: TicketStruttura[];
  onSalva: (dati: TicketUtente) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function UtenteForm({ esistente, strutture, onSalva, onElimina, onClose }: UtenteFormProps) {
  const vuoto: TicketUtente = { id: "", nome: "", email: "", strutturaId: strutture[0]?.id ?? "", reparto: REPARTI[0] };
  const [f, setF] = useState<TicketUtente>(esistente || vuoto);
  function upd(patch: Partial<TicketUtente>) { setF((prev) => ({ ...prev, ...patch })); }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!f.nome.trim()) return;
    onSalva(f);
  }
  return (
    <Modal title={esistente ? "Modifica utente" : "Nuovo utente"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome e cognome">
          <input required className={inputCls} value={f.nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd({ nome: e.target.value })} placeholder="Es. Maria Conti" />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={f.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd({ email: e.target.value })} placeholder="nome.cognome@urbanhomy.it" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sede">
            <select className={inputCls} value={f.strutturaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ strutturaId: e.target.value })}>
              {strutture.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          <Field label="Reparto">
            <select className={inputCls} value={f.reparto} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => upd({ reparto: e.target.value })}>
              {REPARTI.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-200">
          {onElimina ? (
            <button type="button" onClick={onElimina} className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-sm font-semibold">
              <Trash2 size={15} /> Elimina
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-500 hover:bg-stone-100">Annulla</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#2D6BC1] hover:bg-[#25569c] text-white">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
