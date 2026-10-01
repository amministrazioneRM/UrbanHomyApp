import React, { useState } from "react";
import {
  ShieldCheck, Plus, Pencil, Trash2, X, ArrowLeft, Mail, Users, Grid3x3, Lock, Check, Copy, CalendarClock, Settings, ChevronDown, MapPin, MapPinOff
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
        <aside className="md:w-60 shrink-0 bg-[#241B3A] text-stone-200 flex md:flex-col">
          <div className="px-5 py-5 border-b border-white/10 hidden md:block">
            <a href="/" className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 transition mb-3">
              <ArrowLeft size={12} /> Applicazioni Urban Homy
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#5B4B9E] flex items-center justify-center">
                <ShieldCheck size={16} className="text-white" />
              </div>
              <div>
                <div className="font-[Fraunces] font-semibold text-white text-[15px] leading-none">Utenti e accessi</div>
                <div className="text-[11px] text-stone-400 tracking-wide">Urban Homy · utenti</div>
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
            <button
              onClick={() => setVista("utenti")}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                vista === "utenti" ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
              }`}
            >
              <Users size={16} />
              Utenti
            </button>

            <div className="md:mt-1">
              <button
                onClick={() => setImpostazioniAperte((v) => !v)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  TAB_IMPOSTAZIONI.includes(vista) ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                }`}
              >
                <Settings size={16} />
                Impostazioni
                <ChevronDown size={14} className={`ml-auto transition-transform hidden md:block ${impostazioniAperte ? "rotate-180" : ""}`} />
              </button>
              {impostazioniAperte && (
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
          <div className="mt-auto px-5 py-3 text-[11px] text-stone-500 hidden md:block border-t border-white/10">
            {accounts.length} utenti · {ruoli.length} ruoli · {sedi.length} sedi
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
  onSalvaSostituto: (dati: UHSostituto) => void;
  onEliminaSostituto: (id: string) => void;
  isProprioAccount: boolean;
  onSalva: (dati: UHAccount) => void;
  onElimina: (() => void) | null;
  onClose: () => void;
}

function UtenteForm({
  esistente, ruoli, accounts, sostituti,
  onSalvaSostituto, onEliminaSostituto, isProprioAccount,
  onSalva, onElimina, onClose,
}: UtenteFormProps): JSX.Element {
  const vuoto: AccountDraft = {
    id: null, nome: "", email: "", password: "", ruoloGlobale: "Utente",
    accessi: UHAccounts.accessoVuoto(),
  };
  const [f, setF] = useState<AccountDraft>(
    esistente
      ? { ...esistente, password: "", accessi: { ...UHAccounts.accessoVuoto(), ...esistente.accessi } }
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
