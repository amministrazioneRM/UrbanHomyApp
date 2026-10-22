## Why

Diverse aree del frontend utilizzano `localStorage` come persistenza mock per dati che appartengono al backend: ruoli/permessi, sedi e sostituzioni tra utenti. Questo crea una fonte di verità distribuita e incoerente, impedisce la sincronizzazione multi-dispositivo e rende impossibile applicare logiche di autorizzazione server-side. La migrazione è necessaria per rendere il sistema production-ready.

## What Changes

- Rimozione di `"uh_ruoli"` dal localStorage: i ruoli/permessi vengono letti e scritti tramite API REST dedicate e persistiti nel database.
- Rimozione di `"uh_sedi"` dal localStorage: l'elenco delle sedi viene caricato via API (endpoint già parzialmente esistente), eliminando il fallback su `DEFAULT_SEDI` hardcoded.
- Rimozione di `"uh_sostituti"` dal localStorage: le sostituzioni temporanee tra utenti vengono gestite tramite tabella dedicata nel DB e relative API CRUD.
- Rimozione dei dev-helper `"uh_utenteCorrenteId"` e `"uhit_utenteCorrenteId"`: la simulazione utente viene rimpiazzata con la sessione reale derivata dal token JWT già presente (`"uh_session"`).
- Allineamento del file legacy `shared/accounts.js` con `shared/accounts.ts`: rimozione della logica `uh_accounts` ancora attiva nel file JS.

**Invariati (uso corretto di localStorage):**
- `"uh_token"` — JWT Bearer token: persistenza client-side standard.
- `"uh_session"` — snapshot account loggato: popolato dal backend al login, rimosso al logout.

## Capabilities

### New Capabilities

- `roles-and-permissions-api`: API CRUD backend per la gestione di ruoli e permessi per app; il frontend li legge e scrive via HTTP invece di localStorage.
- `sedi-api`: API per la lettura (e opzionale gestione) delle sedi; il frontend rimuove il fallback su `DEFAULT_SEDI` hardcoded.
- `sostituti-api`: API CRUD per le sostituzioni temporanee tra utenti, con tabella dedicata nel DB.
- `real-user-session`: Eliminazione dei selettori "utente corrente simulato" nelle app Manutenzioni e Ticket IT; l'utente mostrato è sempre quello della sessione JWT reale.

### Modified Capabilities

- `user-management`: Il ciclo di vita degli account non dipende più da `uh_accounts` nel file legacy JS; allineamento del file `accounts.js` con la logica già presente in `accounts.ts`.

## Impact

- **Backend**: Nuove route/controller in `backend/src/` per ruoli, sedi e sostituti; nuove migration Prisma per le tabelle mancanti (`Ruolo`, `Sostituto`; `Sede`/`Struttura` potrebbe già esistere).
- **Frontend shared**: `shared/accounts.ts` — rimozione di `loadRoles`, `saveRoles`, `loadSostituti`, `saveSostituti`, `loadSedi`, `saveSedi` basate su localStorage; sostituzione con chiamate `fetch` alle nuove API.
- **App Manutenzioni** (`apps/manutenzioni/src/App.tsx`): rimozione selettore utente simulato e relative letture/scritture di `uh_utenteCorrenteId`.
- **App Ticket IT** (`apps/ticket-it/src/App.tsx`): rimozione selettore utente simulato e relative letture/scritture di `uhit_utenteCorrenteId`.
- **File legacy**: `shared/accounts.js` — allineamento o deprecazione.
- **Cartelle/file segnalati come potenzialmente eliminabili post-migrazione**: nessuna cartella dedicata ai mock è stata trovata; i dati seed sono inline nei componenti React (`seed*` vars in `App.tsx`) e negli script `backend/scripts/` — questi ultimi devono rimanere per il setup iniziale del DB.
