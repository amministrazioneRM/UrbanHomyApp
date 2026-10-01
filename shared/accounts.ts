/* ------------------------------------------------------------------ */
/*  Urban Homy — directory utenti e accessi condivisa                   */
/*  Usata da: home (script semplice), Manutenzioni, Ticket IT, Utenti   */
/*  (importata via esbuild nelle app React, caricata come <script>      */
/*  globale nella home page). Tutto vive in localStorage: NON è un      */
/*  vero sistema di autenticazione, è verificato solo nel browser.      */
/*                                                                      */
/*  Ruoli: ogni app definisce dei "moduli" (le sue sezioni interne).    */
/*  Un ruolo appartiene a UNA app e assegna, per ciascun modulo, i      */
/*  permessi lettura/modifica/creazione/eliminazione. Ogni app ha un    */
/*  ruolo "Amministratore" bloccato (accesso completo, non modificabile */
/*  né eliminabile): è quello che le app consumer usano per il gate     */
/*  delle sezioni riservate (UHAccounts.ruoloIn(...) === "Amministratore").*/
/* ------------------------------------------------------------------ */

export type AppId = "manutenzioni" | "ticketIt" | "baggyLocker" | "vendingMachine";

export interface PermessiEntry {
  lettura: boolean;
  modifica: boolean;
  creazione: boolean;
  eliminazione: boolean;
}

export type PermessiMap = Record<string, PermessiEntry>;

export interface AccessoApp {
  abilitato: boolean;
  ruoloId: string;
}

export type AccessiMap = Partial<Record<AppId, AccessoApp>>;

export interface UHAccount {
  id: string;
  nome: string;
  email: string;
  password?: string;
  ruoloGlobale: "Amministratore" | "Utente";
  accessi: AccessiMap;
}

export interface UHRuolo {
  id: string;
  appId: AppId;
  nome: string;
  bloccato: boolean;
  permessi: PermessiMap;
}

export interface UHSostituto {
  id: string;
  titolareId: string;
  appId: AppId;
  sostitutoId: string;
  dataInizio: string;
  dataFine: string;
  note?: string;
}

export interface UHSede {
  id: string;
  nome: string;
  tipo: string;
  citta?: string;
  indirizzo?: string;
  attiva: boolean;
}

declare global {
  interface Window {
    __UH_API_BASE__?: string;
    __UH_MSAL_CLIENT_ID__?: string;
    __UH_MSAL_TENANT_ID__?: string;
  }
}

const ACCOUNTS_KEY = "uh_accounts";
const SESSION_KEY = "uh_session";
const ROLES_KEY = "uh_ruoli";
const SOSTITUTI_KEY = "uh_sostituti";
const SEDI_KEY = "uh_sedi";
const TOKEN_KEY = "uh_token";
const API_BASE = (typeof window !== "undefined" && window.__UH_API_BASE__) || "http://localhost:4000/api";

interface AppDef {
  id: AppId;
  nome: string;
  moduli: { id: string; nome: string }[];
}

const APPS: AppDef[] = [
  {
    id: "manutenzioni", nome: "Manutenzioni",
    moduli: [
      { id: "interventi", nome: "Interventi" },
      { id: "calendario", nome: "Calendario" },
      { id: "censimento", nome: "Censimento" },
      { id: "manutentori", nome: "Manutentori" },
      { id: "ditte", nome: "Ditte esterne" },
      { id: "anagrafica", nome: "Anagrafica" },
    ],
  },
  {
    id: "ticketIt", nome: "Ticket",
    moduli: [
      { id: "ticket", nome: "Ticket" },
      { id: "utenti", nome: "Utenti" },
    ],
  },
  {
    id: "baggyLocker", nome: "Baggy Locker",
    moduli: [
      { id: "ordini", nome: "Vendite" },
      { id: "vending", nome: "Vending Machine" },
      { id: "sedi", nome: "Sedi" },
    ],
  },
  {
    id: "vendingMachine", nome: "Vending Machine",
    moduli: [
      { id: "vendite", nome: "Vendite" },
      { id: "sedi", nome: "Sedi" },
    ],
  },
];

const RUOLI = ["Amministratore", "Utente"]; // ruolo globale dell'account (super-admin vs utente normale)

const TIPI_SEDE = ["Hotel", "B&B", "Sede amministrativa", "Deposito bagagli", "Altro"];

const DEFAULT_SEDI: UHSede[] = [
  { id: "SEDE-1", nome: "Hotello Trieste", tipo: "Hotel", citta: "Trieste", indirizzo: "", attiva: true },
  { id: "SEDE-2", nome: "Hotello Padova", tipo: "Hotel", citta: "Padova", indirizzo: "", attiva: true },
  { id: "SEDE-3", nome: "Urban Homy Gorizia", tipo: "B&B", citta: "Gorizia", indirizzo: "", attiva: true },
  { id: "SEDE-4", nome: "Europalace Hotel", tipo: "Hotel", citta: "Monfalcone", indirizzo: "", attiva: true },
  { id: "SEDE-5", nome: "Sede amministrativa", tipo: "Sede amministrativa", citta: "", indirizzo: "", attiva: true },
  { id: "SEDE-6", nome: "Baggy Locker Padova", tipo: "Deposito bagagli", citta: "Padova", indirizzo: "", attiva: true },
  { id: "SEDE-7", nome: "Baggy Locker Trieste", tipo: "Deposito bagagli", citta: "Trieste", indirizzo: "", attiva: false },
];

const PERMESSI = [
  { id: "lettura", nome: "Lettura" },
  { id: "modifica", nome: "Modifica" },
  { id: "creazione", nome: "Creazione" },
  { id: "eliminazione", nome: "Eliminazione" },
];

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

function moduliOf(appId: string): { id: string; nome: string }[] {
  const app = APPS.find((a) => a.id === appId);
  return app ? app.moduli : [];
}

function permessiVuoti(): PermessiEntry { return { lettura: false, modifica: false, creazione: false, eliminazione: false }; }
function permessiCompleti(): PermessiEntry { return { lettura: true, modifica: true, creazione: true, eliminazione: true }; }

function matricePermessi(appId: string, riempimento: string): PermessiMap {
  const m: PermessiMap = {};
  moduliOf(appId).forEach((mod) => {
    m[mod.id] = riempimento === "completi" ? permessiCompleti() : permessiVuoti();
  });
  return m;
}

function ruoloAdminId(appId: string): string { return "RUOLO-" + appId + "-admin"; }
function ruoloUtenteId(appId: string): string { return "RUOLO-" + appId + "-utente"; }

function defaultRolesForApp(appId: AppId): UHRuolo[] {
  const matriceUtente = matricePermessi(appId, "vuoti");
  Object.keys(matriceUtente).forEach((moduloId) => { matriceUtente[moduloId].lettura = true; });
  return [
    { id: ruoloAdminId(appId), appId: appId, nome: "Amministratore", bloccato: true, permessi: matricePermessi(appId, "completi") },
    { id: ruoloUtenteId(appId), appId: appId, nome: "Utente", bloccato: false, permessi: matriceUtente },
  ];
}

const DEFAULT_ROLES: UHRuolo[] = APPS.reduce<UHRuolo[]>((acc, app) => acc.concat(defaultRolesForApp(app.id)), []);

function accessoVuoto(): AccessiMap {
  const out: AccessiMap = {};
  APPS.forEach((app) => {
    out[app.id] = { abilitato: false, ruoloId: ruoloUtenteId(app.id) };
  });
  return out;
}

const DEFAULT_ACCOUNTS: UHAccount[] = [
  {
    id: "ACC-1", nome: "Amministratore", email: "admin@urbanhomy.it", password: "admin123",
    ruoloGlobale: "Amministratore",
    accessi: accessoVuoto(),
  },
  {
    id: "ACC-5", nome: "Michele Antoci", email: "michele.antoci@urbanhomy.com", password: "urbanhomy123",
    ruoloGlobale: "Amministratore",
    accessi: accessoVuoto(),
  },
  {
    id: "ACC-2", nome: "Marco Bortolotti", email: "marco.b@urbanhomy.it", password: "manutenzione123",
    ruoloGlobale: "Utente",
    accessi: {
      manutenzioni: { abilitato: true, ruoloId: ruoloAdminId("manutenzioni") },
      ticketIt: { abilitato: false, ruoloId: ruoloUtenteId("ticketIt") },
    },
  },
  {
    id: "ACC-3", nome: "Maria Conti", email: "maria.c@urbanhomy.it", password: "reception123",
    ruoloGlobale: "Utente",
    accessi: {
      manutenzioni: { abilitato: false, ruoloId: ruoloUtenteId("manutenzioni") },
      ticketIt: { abilitato: true, ruoloId: ruoloUtenteId("ticketIt") },
    },
  },
  {
    id: "ACC-4", nome: "Davide Russo", email: "davide.r@urbanhomy.it", password: "amministrazione123",
    ruoloGlobale: "Utente",
    accessi: {
      manutenzioni: { abilitato: false, ruoloId: ruoloUtenteId("manutenzioni") },
      ticketIt: { abilitato: true, ruoloId: ruoloAdminId("ticketIt") },
    },
  },
];

// Migra account salvati con lo schema precedente (accessi[app].ruolo come stringa
// "Amministratore"/"Utente") verso il nuovo schema con ruoloId.
function migraAccount(a: UHAccount & { accessi: Record<string, AccessoApp & { ruolo?: string }> }): UHAccount {
  if (a && a.accessi) {
    Object.keys(a.accessi).forEach((appId) => {
      const acc = a.accessi[appId];
      if (acc && !acc.ruoloId) {
        acc.ruoloId = acc.ruolo === "Amministratore" ? ruoloAdminId(appId) : ruoloUtenteId(appId);
        delete acc.ruolo;
      }
    });
  }
  return a;
}

function loadAccounts(): UHAccount[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(ACCOUNTS_KEY); } catch (e) {}
  if (!raw) {
    saveAccounts(DEFAULT_ACCOUNTS);
    return clone(DEFAULT_ACCOUNTS);
  }
  try { return JSON.parse(raw).map(migraAccount); } catch (e) { return clone(DEFAULT_ACCOUNTS); }
}
function saveAccounts(list: UHAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function loadRoles(): UHRuolo[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(ROLES_KEY); } catch (e) {}
  if (!raw) {
    saveRoles(DEFAULT_ROLES);
    return clone(DEFAULT_ROLES);
  }
  try { return JSON.parse(raw); } catch (e) { return clone(DEFAULT_ROLES); }
}
function saveRoles(list: UHRuolo[]): void {
  localStorage.setItem(ROLES_KEY, JSON.stringify(list));
}
function rolesForApp(appId: string): UHRuolo[] {
  return loadRoles().filter((r) => r.appId === appId);
}
function roleById(id: string): UHRuolo | null {
  return loadRoles().find((r) => r.id === id) || null;
}

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function loadSostituti(): UHSostituto[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SOSTITUTI_KEY); } catch (e) {}
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}
function saveSostituti(list: UHSostituto[]): void {
  localStorage.setItem(SOSTITUTI_KEY, JSON.stringify(list));
}
// La sostituzione (se presente) attiva per `sostitutoId` sull'app `appId` alla data
// `dataStr` (default oggi): durante il periodo, il sostituto eredita l'accesso e il
// ruolo diretti del titolare per quell'app (non si considerano sostituzioni a catena).
function sostituzioneAttiva(sostitutoId: string, appId: string, dataStr?: string): UHSostituto | null {
  const data = dataStr || oggiISO();
  return loadSostituti().find((s) => {
    return s.sostitutoId === sostitutoId && s.appId === appId && s.dataInizio <= data && data <= s.dataFine;
  }) || null;
}

function loadSedi(): UHSede[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SEDI_KEY); } catch (e) {}
  if (!raw) {
    saveSedi(DEFAULT_SEDI);
    return clone(DEFAULT_SEDI);
  }
  try { return JSON.parse(raw); } catch (e) { return clone(DEFAULT_SEDI); }
}
function saveSedi(list: UHSede[]): void {
  localStorage.setItem(SEDI_KEY, JSON.stringify(list));
}

function loadSession(): UHAccount | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SESSION_KEY); } catch (e) {}
  if (!raw) return null;
  try {
    const sess = JSON.parse(raw);
    const attuale = loadAccounts().find((a) => a.id === sess.id);
    return attuale || null;
  } catch (e) { return null; }
}
function saveSession(account: UHAccount): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: account.id }));
}
function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}

// Aggiorna/inserisce `account` nella cache locale di loadAccounts(), così
// loadSession()/hasAccesso()/ruoloIn() (tutti sincroni, leggono solo la
// cache) vedono subito il dato appena verificato dal server.
function upsertAccountInCache(account: UHAccount): void {
  const list = loadAccounts().filter((a) => a.id !== account.id);
  list.push(account);
  saveAccounts(list);
}

interface AuthResponse {
  token: string;
  account: UHAccount;
}

function autenticaConRisposta(res: Response): Promise<UHAccount> {
  if (!res.ok) {
    return res.json().catch(() => ({})).then((body: { error?: string }) => {
      throw new Error(body.error || "Accesso non riuscito");
    });
  }
  return res.json().then((data: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    upsertAccountInCache(data.account);
    saveSession(data.account);
    return data.account;
  });
}

// Login reale: verifica email+password sul server (bcrypt), niente più
// confronto in chiaro nel browser. Ritorna una Promise<account>.
function login(email: string, password: string): Promise<UHAccount> {
  return fetch(API_BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  }).then(autenticaConRisposta);
}

// Login Microsoft SSO: msAccessToken è l'access token ottenuto da MSAL
// (scope User.Read). Il server lo verifica chiamando Microsoft Graph /me
// prima di fidarsi dell'identità.
function loginSso(msAccessToken: string): Promise<UHAccount> {
  return fetch(API_BASE + "/auth/sso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msAccessToken: msAccessToken }),
  }).then(autenticaConRisposta);
}

function isAdminGlobale(account: UHAccount | null | undefined): boolean {
  return !!(account && account.ruoloGlobale === "Amministratore");
}

interface AccessoDiretto {
  abilitato: boolean;
  ruolo: { nome: string; permessi: PermessiMap | null; admin?: boolean } | null;
}

// Accesso/ruolo diretti del titolare per un'app, ignorando eventuali sostituzioni
// (evita catene: un sostituto non eredita a sua volta le sostituzioni del titolare).
function accessoDirettoTitolare(titolare: UHAccount | null | undefined, appId: string): AccessoDiretto | null {
  if (!titolare) return null;
  if (isAdminGlobale(titolare)) return { abilitato: true, ruolo: { nome: "Amministratore", permessi: null, admin: true } };
  const accesso = titolare.accessi && titolare.accessi[appId as AppId];
  if (!accesso || !accesso.abilitato) return null;
  return { abilitato: true, ruolo: roleById(accesso.ruoloId) };
}

function hasAccesso(account: UHAccount | null | undefined, appId: string): boolean {
  if (!account) return false;
  if (isAdminGlobale(account)) return true;
  if (account.accessi && account.accessi[appId as AppId] && account.accessi[appId as AppId]!.abilitato) return true;
  const sost = sostituzioneAttiva(account.id, appId);
  if (!sost) return false;
  const titolare = loadAccounts().find((a) => a.id === sost.titolareId);
  return !!accessoDirettoTitolare(titolare, appId);
}

// Nome del ruolo dell'account per una data app (per visualizzazione e per il gate
// "Amministratore" già usato dalle app consumer). Il ruolo Amministratore di ogni
// app è bloccato (non rinominabile/eliminabile) proprio per garantire che questo
// confronto continui a funzionare. Se l'account sta sostituendo qualcuno in questo
// momento su questa app, eredita il ruolo del titolare.
function ruoloIn(account: UHAccount | null | undefined, appId: string): string | null {
  if (!account) return null;
  if (isAdminGlobale(account)) return "Amministratore";
  const accesso = account.accessi && account.accessi[appId as AppId];
  if (accesso && accesso.abilitato) {
    const ruolo = roleById(accesso.ruoloId);
    return (ruolo && ruolo.nome) || "Utente";
  }
  const sost = sostituzioneAttiva(account.id, appId);
  if (sost) {
    const titolare = loadAccounts().find((a) => a.id === sost.titolareId);
    const diretto = accessoDirettoTitolare(titolare, appId);
    if (diretto) return (diretto.ruolo && diretto.ruolo.nome) || "Utente";
  }
  return "Utente";
}

// Permesso granulare: può l'account fare `tipo` (lettura/modifica/creazione/eliminazione)
// sul modulo `moduloId` dell'app `appId`? Considera anche le sostituzioni attive.
function permesso(account: UHAccount | null | undefined, appId: string, moduloId: string, tipo: keyof PermessiEntry): boolean {
  if (!account) return false;
  if (isAdminGlobale(account)) return true;
  const accesso = account.accessi && account.accessi[appId as AppId];
  if (accesso && accesso.abilitato) {
    const ruolo = roleById(accesso.ruoloId);
    const mp = ruolo && ruolo.permessi && ruolo.permessi[moduloId];
    if (mp && mp[tipo]) return true;
  }
  const sost = sostituzioneAttiva(account.id, appId);
  if (sost) {
    const titolare = loadAccounts().find((a) => a.id === sost.titolareId);
    const diretto = accessoDirettoTitolare(titolare, appId);
    if (diretto) {
      if (diretto.ruolo && diretto.ruolo.admin) return true;
      const mpTitolare = diretto.ruolo && diretto.ruolo.permessi && diretto.ruolo.permessi[moduloId];
      if (mpTitolare && mpTitolare[tipo]) return true;
    }
  }
  return false;
}

const UHAccounts = {
  ACCOUNTS_KEY,
  SESSION_KEY,
  ROLES_KEY,
  SEDI_KEY,
  APPS,
  RUOLI,
  PERMESSI,
  TIPI_SEDE,
  DEFAULT_ACCOUNTS,
  DEFAULT_ROLES,
  DEFAULT_SEDI,
  accessoVuoto,
  moduliOf,
  permessiVuoti,
  permessiCompleti,
  matricePermessi,
  loadAccounts,
  saveAccounts,
  loadRoles,
  saveRoles,
  rolesForApp,
  roleById,
  loadSostituti,
  saveSostituti,
  sostituzioneAttiva,
  oggiISO,
  loadSedi,
  saveSedi,
  loadSession,
  saveSession,
  clearSession,
  getToken,
  login,
  loginSso,
  isAdminGlobale,
  hasAccesso,
  ruoloIn,
  permesso,
};

export default UHAccounts;
