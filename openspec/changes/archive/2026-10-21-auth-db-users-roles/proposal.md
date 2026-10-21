## Why

Attualmente la gestione utenti e ruoli è implementata solo lato browser (localStorage), rendendo l'autenticazione bypassabile e priva di persistenza centralizzata. Il progetto ha già un backend con JWT e SSO Microsoft parzialmente funzionante, ma la tabella `utenti_accounts` contiene password in chiaro per tutti gli utenti, mentre il requisito è che solo l'utente admin acceda con credenziali locali e tutti gli altri utenti accedano esclusivamente tramite SSO Microsoft. Serve allineare il database e il backend a questo modello di accesso ibrido.

## What Changes

- Il campo `password` su `utenti_accounts` diventa opzionale (`NULL`): presente solo per l'utente con `ruoloGlobale = "Amministratore"`, assente per tutti gli altri utenti SSO
- La route `POST /api/auth/login` (email + password) resta attiva ma restituisce errore se l'account non ha password (cioè non è l'admin locale)
- La route `POST /api/auth/sso` verifica che l'account trovato per email **non abbia** `ruoloGlobale = "Amministratore"` oppure che sia un account SSO (senza password), come guardrail opzionale
- La schermata Utenti nell'app admin non mostra più il campo password nel form di creazione/modifica utente (gli utenti normali non hanno password)
- L'utente admin (l'unico con password) può essere creato/aggiornato solo tramite una migration di seed dedicata — non esposto nelle CRUD API applicative
- Migrazione DB: `password` diventa `NULL`-able; i record degli utenti non-admin vengono aggiornati con `password = NULL`
- **BREAKING**: la libreria client `shared/accounts.ts` smette di gestire il campo `password` in `DEFAULT_ACCOUNTS` e nei form; i dati di default restano solo come fallback locale (invariato nel funzionamento SSO)

## Capabilities

### New Capabilities

- `admin-local-login`: L'utente admin accede con email + password hashata lato backend; gli altri utenti non possono usare questa route
- `sso-only-users`: Gli utenti non-admin non hanno password nel DB e accedono esclusivamente via SSO Microsoft; la creazione/modifica utente dall'app non espone il campo password

### Modified Capabilities

- `user-management`: La schermata di gestione utenti rimuove il campo password dal form di creazione/modifica; il campo `password` su `UtentiAccount` diventa opzionale nel tipo TypeScript e nel Prisma schema

## Impact

- **Backend**: `backend/prisma/schema.prisma` → campo `password` opzionale; nuova migration SQL; `backend/src/routes/auth.ts` → guardrail su `/login` (account deve avere password) e su `/sso` (account non deve usare login locale)
- **Tipi condivisi**: `shared/accounts.ts` → `UHAccount.password` già opzionale, `DEFAULT_ACCOUNTS` → rimuovere password dai non-admin
- **App Utenti**: form creazione/modifica account → rimuovere campo password; API `POST/PUT /api/utenti/accounts` → non gestisce più il campo password per utenti normali
- **Seed / admin bootstrap**: script o migration per creare/aggiornare l'account admin con password bcrypt
- **Dipendenze**: nessuna nuova dipendenza (bcrypt già presente)
