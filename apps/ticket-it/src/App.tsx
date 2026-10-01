import React, { useState, useMemo, useEffect } from "react";
import {
  LifeBuoy, Ticket as TicketIcon, Plus, ChevronDown, X, AlertTriangle,
  CheckCircle2, Clock3, Loader2, Trash2, Pencil, LayoutGrid, Search,
  Monitor, Package, Wifi, KeyRound, HelpCircle, Camera, Ban,
  Users, UserCog, Mail, Settings, Filter, ArrowLeft, Building2, UserCheck
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
/*  DATI DI PARTENZA — Gruppo Urban Homy                               */
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
    titolo: "Gestionale prenotazioni non si connette", descrizione: "Il PMS perde la connessione internet più volte al giorno.",
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
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
function isScaduto(t: Ticket): boolean {
  return t.stato !== "Risolto" && t.stato !== "Chiuso" && t.scadenza < oggi.toISOString().slice(0, 10);
}

const FILTRO_RAPIDO_LABEL: Record<string, string> = { aperti: "Ticket aperti", urgenti: "Alta priorità", scaduti: "Scaduti", incorso: "In corso" };
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
      className={`flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 shadow-sm text-left ${
        onClick ? "cursor-pointer hover:border-[#2D6BC1]/50 hover:shadow-md transition" : ""
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
  const luogoLabel = (t: Ticket): string => `${strutturaOf(t.strutturaId)?.nome ?? "—"} · ${t.reparto}`;

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
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900 mb-2">Accesso non disponibile</h1>
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
        <aside className="md:w-60 shrink-0 bg-[#1B2340] text-stone-200 flex md:flex-col">
          <div className="px-5 py-5 border-b border-white/10 hidden md:block">
            <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3">
              <ArrowLeft size={12} /> Applicazioni Urban Homy
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#2D6BC1] flex items-center justify-center">
                <LifeBuoy size={16} className="text-white" />
              </div>
              <div>
                <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Ticket</div>
                <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · assistenza IT</div>
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
              { id: "ticket", label: "Ticket", icon: TicketIcon },
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
          <div className="px-5 py-3 text-[11px] text-stone-500 hidden md:block border-t border-white/10">
            {strutture.length} sedi · {utenti.length} utenti
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
          <h1 className="font-[Fraunces] text-2xl md:text-[28px] font-semibold text-stone-900">Cruscotto ticket IT</h1>
          <p className="text-stone-500 text-sm mt-1">Gruppo Urban Homy · tutte le sedi</p>
        </div>
        <button onClick={onNuovo} className="flex items-center gap-2 bg-[#2D6BC1] hover:bg-[#25569c] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
          <Plus size={16} /> Nuovo ticket
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ticket aperti" value={stats.aperti} icon={TicketIcon} accent="bg-[#1B2340]" onClick={() => onFiltroRapido("aperti")} />
        <StatCard label="Alta priorità" value={stats.urgenti} icon={AlertTriangle} accent="bg-[#2D6BC1]" onClick={() => onFiltroRapido("urgenti")} />
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
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Ticket</h1>
          <p className="text-stone-500 text-sm mt-1">
            {utenteCorrente ? <>Connesso come <span className="font-semibold text-stone-700">{utenteCorrente.nome}</span> · {utenteCorrente.reparto}</> : "Richieste di assistenza IT del gruppo"}
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
          <input value={ricerca} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRicerca(e.target.value)} placeholder="Cerca per titolo o descrizione…" className="text-sm outline-none w-full bg-transparent" />
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
                  <div className="text-xs text-stone-500 mt-0.5">{luogoLabel(t)} · richiesto da {t.richiedente || "—"}</div>
                  <div className="text-xs text-stone-400 mt-1 font-mono-tag">{t.id} · scadenza {fmtData(t.scadenza)}</div>
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
          <Field label="Priorità">
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
            <option value="">— non specificato —</option>
            {utenti.map((u) => <option key={u.id} value={u.nome}>{u.nome} · {u.reparto}</option>)}
            <option value="__altro__">Altro (inserisci manualmente)…</option>
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
          {caricamento && <div className="text-xs text-stone-400 mt-1.5">Caricamento in corso…</div>}
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
          <h1 className="font-[Fraunces] text-2xl font-semibold text-stone-900">Utenti</h1>
          <p className="text-stone-500 text-sm mt-1">Personale che può aprire ticket di assistenza IT</p>
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
                  <span className="flex items-center gap-1"><Building2 size={11} /> {strutturaOf(u.strutturaId)?.nome ?? "—"} · {u.reparto}</span>
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
