var _UHAccountsModule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // shared/accounts.ts
  var accounts_exports = {};
  __export(accounts_exports, {
    default: () => accounts_default
  });
  var ACCOUNTS_KEY = "uh_accounts";
  var SESSION_KEY = "uh_session";
  var ROLES_KEY = "uh_ruoli";
  var SOSTITUTI_KEY = "uh_sostituti";
  var SEDI_KEY = "uh_sedi";
  var TOKEN_KEY = "uh_token";
  var API_BASE = typeof window !== "undefined" && window.__UH_API_BASE__ || "http://localhost:4000/api";
  var APPS = [
    {
      id: "manutenzioni",
      nome: "Manutenzioni",
      moduli: [
        { id: "interventi", nome: "Interventi" },
        { id: "calendario", nome: "Calendario" },
        { id: "censimento", nome: "Censimento" },
        { id: "manutentori", nome: "Manutentori" },
        { id: "ditte", nome: "Ditte esterne" },
        { id: "anagrafica", nome: "Anagrafica" }
      ]
    },
    {
      id: "ticketIt",
      nome: "Ticket",
      moduli: [
        { id: "ticket", nome: "Ticket" },
        { id: "utenti", nome: "Utenti" }
      ]
    },
    {
      id: "baggyLocker",
      nome: "Baggy Locker",
      moduli: [
        { id: "ordini", nome: "Vendite" },
        { id: "vending", nome: "Vending Machine" },
        { id: "sedi", nome: "Sedi" }
      ]
    },
    {
      id: "vendingMachine",
      nome: "Vending Machine",
      moduli: [
        { id: "vendite", nome: "Vendite" },
        { id: "sedi", nome: "Sedi" }
      ]
    }
  ];
  var RUOLI = ["Amministratore", "Utente"];
  var TIPI_SEDE = ["Hotel", "B&B", "Sede amministrativa", "Deposito bagagli", "Altro"];
  var DEFAULT_SEDI = [
    { id: "SEDE-1", nome: "Hotello Trieste", tipo: "Hotel", citta: "Trieste", indirizzo: "", attiva: true },
    { id: "SEDE-2", nome: "Hotello Padova", tipo: "Hotel", citta: "Padova", indirizzo: "", attiva: true },
    { id: "SEDE-3", nome: "Urban Homy Gorizia", tipo: "B&B", citta: "Gorizia", indirizzo: "", attiva: true },
    { id: "SEDE-4", nome: "Europalace Hotel", tipo: "Hotel", citta: "Monfalcone", indirizzo: "", attiva: true },
    { id: "SEDE-5", nome: "Sede amministrativa", tipo: "Sede amministrativa", citta: "", indirizzo: "", attiva: true },
    { id: "SEDE-6", nome: "Baggy Locker Padova", tipo: "Deposito bagagli", citta: "Padova", indirizzo: "", attiva: true },
    { id: "SEDE-7", nome: "Baggy Locker Trieste", tipo: "Deposito bagagli", citta: "Trieste", indirizzo: "", attiva: false }
  ];
  var PERMESSI = [
    { id: "lettura", nome: "Lettura" },
    { id: "modifica", nome: "Modifica" },
    { id: "creazione", nome: "Creazione" },
    { id: "eliminazione", nome: "Eliminazione" }
  ];
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  function moduliOf(appId) {
    const app = APPS.find((a) => a.id === appId);
    return app ? app.moduli : [];
  }
  function permessiVuoti() {
    return { lettura: false, modifica: false, creazione: false, eliminazione: false };
  }
  function permessiCompleti() {
    return { lettura: true, modifica: true, creazione: true, eliminazione: true };
  }
  function matricePermessi(appId, riempimento) {
    const m = {};
    moduliOf(appId).forEach((mod) => {
      m[mod.id] = riempimento === "completi" ? permessiCompleti() : permessiVuoti();
    });
    return m;
  }
  function ruoloAdminId(appId) {
    return "RUOLO-" + appId + "-admin";
  }
  function ruoloUtenteId(appId) {
    return "RUOLO-" + appId + "-utente";
  }
  function defaultRolesForApp(appId) {
    const matriceUtente = matricePermessi(appId, "vuoti");
    Object.keys(matriceUtente).forEach((moduloId) => {
      matriceUtente[moduloId].lettura = true;
    });
    return [
      { id: ruoloAdminId(appId), appId, nome: "Amministratore", bloccato: true, permessi: matricePermessi(appId, "completi") },
      { id: ruoloUtenteId(appId), appId, nome: "Utente", bloccato: false, permessi: matriceUtente }
    ];
  }
  var DEFAULT_ROLES = APPS.reduce((acc, app) => acc.concat(defaultRolesForApp(app.id)), []);
  function accessoVuoto() {
    const out = {};
    APPS.forEach((app) => {
      out[app.id] = { abilitato: false, ruoloId: ruoloUtenteId(app.id) };
    });
    return out;
  }
  var DEFAULT_ACCOUNTS = [
    {
      id: "ACC-1",
      nome: "Amministratore",
      email: "admin@urbanhomy.it",
      password: "admin123",
      ruoloGlobale: "Amministratore",
      accessi: accessoVuoto()
    },
    {
      id: "ACC-5",
      nome: "Michele Antoci",
      email: "michele.antoci@urbanhomy.com",
      password: "urbanhomy123",
      ruoloGlobale: "Amministratore",
      accessi: accessoVuoto()
    },
    {
      id: "ACC-2",
      nome: "Marco Bortolotti",
      email: "marco.b@urbanhomy.it",
      password: "manutenzione123",
      ruoloGlobale: "Utente",
      accessi: {
        manutenzioni: { abilitato: true, ruoloId: ruoloAdminId("manutenzioni") },
        ticketIt: { abilitato: false, ruoloId: ruoloUtenteId("ticketIt") }
      }
    },
    {
      id: "ACC-3",
      nome: "Maria Conti",
      email: "maria.c@urbanhomy.it",
      password: "reception123",
      ruoloGlobale: "Utente",
      accessi: {
        manutenzioni: { abilitato: false, ruoloId: ruoloUtenteId("manutenzioni") },
        ticketIt: { abilitato: true, ruoloId: ruoloUtenteId("ticketIt") }
      }
    },
    {
      id: "ACC-4",
      nome: "Davide Russo",
      email: "davide.r@urbanhomy.it",
      password: "amministrazione123",
      ruoloGlobale: "Utente",
      accessi: {
        manutenzioni: { abilitato: false, ruoloId: ruoloUtenteId("manutenzioni") },
        ticketIt: { abilitato: true, ruoloId: ruoloAdminId("ticketIt") }
      }
    }
  ];
  function migraAccount(a) {
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
  function loadAccounts() {
    let raw = null;
    try {
      raw = localStorage.getItem(ACCOUNTS_KEY);
    } catch (e) {
    }
    if (!raw) {
      saveAccounts(DEFAULT_ACCOUNTS);
      return clone(DEFAULT_ACCOUNTS);
    }
    try {
      return JSON.parse(raw).map(migraAccount);
    } catch (e) {
      return clone(DEFAULT_ACCOUNTS);
    }
  }
  function saveAccounts(list) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  }
  function loadRoles() {
    let raw = null;
    try {
      raw = localStorage.getItem(ROLES_KEY);
    } catch (e) {
    }
    if (!raw) {
      saveRoles(DEFAULT_ROLES);
      return clone(DEFAULT_ROLES);
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return clone(DEFAULT_ROLES);
    }
  }
  function saveRoles(list) {
    localStorage.setItem(ROLES_KEY, JSON.stringify(list));
  }
  function rolesForApp(appId) {
    return loadRoles().filter((r) => r.appId === appId);
  }
  function roleById(id) {
    return loadRoles().find((r) => r.id === id) || null;
  }
  function oggiISO() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  function loadSostituti() {
    let raw = null;
    try {
      raw = localStorage.getItem(SOSTITUTI_KEY);
    } catch (e) {
    }
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  function saveSostituti(list) {
    localStorage.setItem(SOSTITUTI_KEY, JSON.stringify(list));
  }
  function sostituzioneAttiva(sostitutoId, appId, dataStr) {
    const data = dataStr || oggiISO();
    return loadSostituti().find((s) => {
      return s.sostitutoId === sostitutoId && s.appId === appId && s.dataInizio <= data && data <= s.dataFine;
    }) || null;
  }
  function loadSedi() {
    let raw = null;
    try {
      raw = localStorage.getItem(SEDI_KEY);
    } catch (e) {
    }
    if (!raw) {
      saveSedi(DEFAULT_SEDI);
      return clone(DEFAULT_SEDI);
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return clone(DEFAULT_SEDI);
    }
  }
  function saveSedi(list) {
    localStorage.setItem(SEDI_KEY, JSON.stringify(list));
  }
  function loadSession() {
    let raw = null;
    try {
      raw = localStorage.getItem(SESSION_KEY);
    } catch (e) {
    }
    if (!raw) return null;
    try {
      const sess = JSON.parse(raw);
      const attuale = loadAccounts().find((a) => a.id === sess.id);
      return attuale || null;
    } catch (e) {
      return null;
    }
  }
  function saveSession(account) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: account.id }));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }
  function upsertAccountInCache(account) {
    const list = loadAccounts().filter((a) => a.id !== account.id);
    list.push(account);
    saveAccounts(list);
  }
  function autenticaConRisposta(res) {
    if (!res.ok) {
      return res.json().catch(() => ({})).then((body) => {
        throw new Error(body.error || "Accesso non riuscito");
      });
    }
    return res.json().then((data) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      upsertAccountInCache(data.account);
      saveSession(data.account);
      return data.account;
    });
  }
  function login(email, password) {
    return fetch(API_BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    }).then(autenticaConRisposta);
  }
  function loginSso(msAccessToken) {
    return fetch(API_BASE + "/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msAccessToken })
    }).then(autenticaConRisposta);
  }
  function isAdminGlobale(account) {
    return !!(account && account.ruoloGlobale === "Amministratore");
  }
  function accessoDirettoTitolare(titolare, appId) {
    if (!titolare) return null;
    if (isAdminGlobale(titolare)) return { abilitato: true, ruolo: { nome: "Amministratore", permessi: null, admin: true } };
    const accesso = titolare.accessi && titolare.accessi[appId];
    if (!accesso || !accesso.abilitato) return null;
    return { abilitato: true, ruolo: roleById(accesso.ruoloId) };
  }
  function hasAccesso(account, appId) {
    if (!account) return false;
    if (isAdminGlobale(account)) return true;
    if (account.accessi && account.accessi[appId] && account.accessi[appId].abilitato) return true;
    const sost = sostituzioneAttiva(account.id, appId);
    if (!sost) return false;
    const titolare = loadAccounts().find((a) => a.id === sost.titolareId);
    return !!accessoDirettoTitolare(titolare, appId);
  }
  function ruoloIn(account, appId) {
    if (!account) return null;
    if (isAdminGlobale(account)) return "Amministratore";
    const accesso = account.accessi && account.accessi[appId];
    if (accesso && accesso.abilitato) {
      const ruolo = roleById(accesso.ruoloId);
      return ruolo && ruolo.nome || "Utente";
    }
    const sost = sostituzioneAttiva(account.id, appId);
    if (sost) {
      const titolare = loadAccounts().find((a) => a.id === sost.titolareId);
      const diretto = accessoDirettoTitolare(titolare, appId);
      if (diretto) return diretto.ruolo && diretto.ruolo.nome || "Utente";
    }
    return "Utente";
  }
  function permesso(account, appId, moduloId, tipo) {
    if (!account) return false;
    if (isAdminGlobale(account)) return true;
    const accesso = account.accessi && account.accessi[appId];
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
  var UHAccounts = {
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
    permesso
  };
  var accounts_default = UHAccounts;
  return __toCommonJS(accounts_exports);
})();
window.UHAccounts = _UHAccountsModule.default;
