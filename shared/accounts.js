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
    // Gli accounts sono gestiti esclusivamente dal backend.
    return [];
  }
  function saveAccounts(_list) {
    // No-op: gli accounts non vengono più persistiti nel localStorage.
  }
  function fetchRoles() {
    const token = getToken();
    return fetch(API_BASE + "/utenti/ruoli", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    }).then(function(res) {
      if (!res.ok) return [];
      return res.json().then(function(data) { return Array.isArray(data) ? data : []; });
    }).catch(function(e) {
      console.error("fetchRoles error:", e);
      return [];
    });
  }
  function syncRoles(list) {
    const token = getToken();
    return fetch(API_BASE + "/utenti/ruoli/batch", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
      body: JSON.stringify(list),
    }).catch(function(e) { console.error("syncRoles error:", e); });
  }
  function rolesForApp(appId, ruoli) {
    return (ruoli || DEFAULT_ROLES).filter(function(r) { return r.appId === appId; });
  }
  function roleById(id, ruoli) {
    return (ruoli || DEFAULT_ROLES).find(function(r) { return r.id === id; }) || null;
  }
  function oggiISO() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  function fetchSostituti() {
    const token = getToken();
    return fetch(API_BASE + "/utenti/sostituti", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    }).then(function(res) {
      if (!res.ok) return [];
      return res.json().then(function(data) { return Array.isArray(data) ? data : []; });
    }).catch(function(e) {
      console.error("fetchSostituti error:", e);
      return [];
    });
  }
  function syncSostituti(list) {
    const token = getToken();
    return fetch(API_BASE + "/utenti/sostituti/batch", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
      body: JSON.stringify(list),
    }).catch(function(e) { console.error("syncSostituti error:", e); });
  }
  function sostituzioneAttiva(sostitutoId, appId, dataStr, sostituti) {
    const data = dataStr || oggiISO();
    return (sostituti || []).find(function(s) {
      return s.sostitutoId === sostitutoId && s.appId === appId && s.dataInizio <= data && data <= s.dataFine;
    }) || null;
  }
  function fetchSedi() {
    const token = getToken();
    return fetch(API_BASE + "/utenti/sedi", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    }).then(function(res) {
      if (!res.ok) return [];
      return res.json().then(function(data) { return Array.isArray(data) ? data : []; });
    }).catch(function(e) {
      console.error("fetchSedi error:", e);
      return [];
    });
  }
  function syncSedi(list) {
    const token = getToken();
    return fetch(API_BASE + "/utenti/sedi/batch", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
      body: JSON.stringify(list),
    }).catch(function(e) { console.error("syncSedi error:", e); });
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
      if (sess && sess.id && sess.email) return sess;
      return null;
    } catch (e) {
      return null;
    }
  }
  function saveSession(account) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(account));
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
  function autenticaConRisposta(res) {
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(body) {
        throw new Error(body.error || "Accesso non riuscito");
      });
    }
    return res.json().then(function(data) {
      localStorage.setItem(TOKEN_KEY, data.token);
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
  function accessoDirettoTitolare(titolare, appId, ruoli) {
    if (!titolare) return null;
    if (isAdminGlobale(titolare)) return { abilitato: true, ruolo: { nome: "Amministratore", permessi: null, admin: true } };
    const accesso = titolare.accessi && titolare.accessi[appId];
    if (!accesso || !accesso.abilitato) return null;
    return { abilitato: true, ruolo: roleById(accesso.ruoloId, ruoli) };
  }
  function hasAccesso(account, appId, sostituti, accounts) {
    if (!account) return false;
    if (isAdminGlobale(account)) return true;
    if (account.accessi && account.accessi[appId] && account.accessi[appId].abilitato) return true;
    const sost = sostituzioneAttiva(account.id, appId, void 0, sostituti || []);
    if (!sost) return false;
    const titolare = (accounts || []).find(function(a) { return a.id === sost.titolareId; });
    return !!accessoDirettoTitolare(titolare, appId);
  }
  function ruoloIn(account, appId, ruoli, sostituti, accounts) {
    if (!account) return null;
    if (isAdminGlobale(account)) return "Amministratore";
    const accesso = account.accessi && account.accessi[appId];
    if (accesso && accesso.abilitato) {
      const ruolo = roleById(accesso.ruoloId, ruoli);
      return ruolo && ruolo.nome || "Utente";
    }
    const sost = sostituzioneAttiva(account.id, appId, void 0, sostituti || []);
    if (sost) {
      const titolare = (accounts || []).find(function(a) { return a.id === sost.titolareId; });
      const diretto = accessoDirettoTitolare(titolare, appId, ruoli);
      if (diretto) return diretto.ruolo && diretto.ruolo.nome || "Utente";
    }
    return "Utente";
  }
  function permesso(account, appId, moduloId, tipo, ruoli, sostituti, accounts) {
    if (!account) return false;
    if (isAdminGlobale(account)) return true;
    const accesso = account.accessi && account.accessi[appId];
    if (accesso && accesso.abilitato) {
      const ruolo = roleById(accesso.ruoloId, ruoli);
      const mp = ruolo && ruolo.permessi && ruolo.permessi[moduloId];
      if (mp && mp[tipo]) return true;
    }
    const sost = sostituzioneAttiva(account.id, appId, void 0, sostituti || []);
    if (sost) {
      const titolare = (accounts || []).find(function(a) { return a.id === sost.titolareId; });
      const diretto = accessoDirettoTitolare(titolare, appId, ruoli);
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
    APPS,
    RUOLI,
    PERMESSI,
    TIPI_SEDE,
    DEFAULT_ACCOUNTS,
    DEFAULT_ROLES,
    accessoVuoto,
    moduliOf,
    permessiVuoti,
    permessiCompleti,
    matricePermessi,
    loadAccounts,
    saveAccounts,
    fetchRoles,
    syncRoles,
    rolesForApp,
    roleById,
    fetchSostituti,
    syncSostituti,
    sostituzioneAttiva,
    oggiISO,
    fetchSedi,
    syncSedi,
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
