# Urban Homy — Portale applicazioni

Home page del portale: login condiviso (email/password demo + SSO Microsoft) e
launcher verso le applicazioni del gruppo (Manutenzioni, Ticket IT, Utenti e
accessi). Nessun backend: gli account e la sessione vivono in `localStorage`,
condivisi tra le app perché servite sotto lo stesso dominio/porta.

## Configurare il login con Microsoft (SSO)

Il pulsante "Accedi con Microsoft" in [index.html](index.html) usa
[MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
(caricato via CDN, nessuna installazione necessaria) e richiede una **App
Registration** su Microsoft Entra ID (ex Azure AD) del tenant Urban Homy.
Finché non viene configurata, il pulsante resta visibile ma disabilitato con
la nota "SSO Microsoft non ancora configurato".

### 1. Crea la App Registration

1. Vai su [entra.microsoft.com](https://entra.microsoft.com) (oppure
   [portal.azure.com](https://portal.azure.com) → *Microsoft Entra ID*).
2. Nel menu **App registrations** → **New registration**.
3. **Nome**: es. `Urban Homy Portal`.
4. **Supported account types**: scegli *Accounts in this organizational
   directory only* (solo il tenant Urban Homy — consigliato per uso interno).
5. **Redirect URI**: tipo **Single-page application (SPA)**, valore
   `http://localhost:5173/` per i test in locale. Aggiungi anche l'URL di
   produzione quando il portale sarà pubblicato online (es.
   `https://portale.urbanhomy.it/`).
6. Clicca **Register**.

Non serve creare un *client secret*: le SPA usano il flusso pubblico con PKCE.

### 2. Recupera Client ID e Tenant ID

Nella pagina **Overview** della App Registration appena creata, copia:
- **Application (client) ID**
- **Directory (tenant) ID**

### 3. Verifica i permessi

In **API permissions** dovrebbe già esserci `User.Read` (Microsoft Graph,
permesso delegato) aggiunto di default. Se manca, aggiungilo da **Add a
permission → Microsoft Graph → Delegated permissions → User.Read**.

### 4. Incolla i valori nel codice

Apri [index.html](index.html), cerca `MSAL_CONFIG` (vicino alla fine del
file) e sostituisci:

```js
var MSAL_CONFIG = {
  clientId: "REPLACE_WITH_YOUR_CLIENT_ID",   // ← Application (client) ID
  tenantId: "REPLACE_WITH_YOUR_TENANT_ID",   // ← Directory (tenant) ID
};
```

Salva: il pulsante "Accedi con Microsoft" si attiva automaticamente.

### Come funziona l'autorizzazione dopo il login Microsoft

Il login con Microsoft verifica solo **chi è** la persona (autenticazione
reale, tramite Microsoft). Il portale poi cerca la sua email nell'elenco
utenti condiviso (`localStorage`, gestito dall'app **Utenti e accessi**):

- se l'email **non è presente**, l'accesso viene bloccato con un messaggio
  "contatta un amministratore" — nessun account viene creato in automatico;
- se l'email **è presente**, l'utente entra con i permessi già assegnati
  (ruolo globale e accesso per applicazione) esattamente come con il login
  email/password demo.

Un amministratore deve quindi aggiungere prima la persona (con la stessa
email del suo account Microsoft) da **Utenti e accessi**, prima che possa
accedere con SSO.

### Limiti dell'ambiente attuale

Anche con SSO reale, l'**autorizzazione** (chi può aprire quale app, con
quale ruolo) resta gestita lato client in `localStorage`: non c'è un backend
che la faccia rispettare, quindi rimane un ambiente dimostrativo dal punto di
vista della sicurezza applicativa, anche se l'autenticazione via Microsoft è
reale.
