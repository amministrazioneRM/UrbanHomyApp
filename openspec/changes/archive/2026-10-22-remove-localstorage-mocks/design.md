## Context

Il backend ha già le tabelle Prisma (`UtentiRuolo`, `UtentiSostituto`, `UtentiSede`) e le route REST corrispondenti (`/api/utenti/ruoli`, `/api/utenti/sostituti`, `/api/utenti/sedi`) generate tramite `makeCrudRouter`. Le stesse entità sono però gestite in `shared/accounts.ts` esclusivamente via `localStorage`, che fa da "database locale" per queste tre aree.

L'app Utenti legge/scrive ruoli, sedi e sostituti tramite il hook `useSyncedResource` (che già usa le API). Il problema è che `shared/accounts.ts` — usato come libreria condivisa da tutte le altre app (manutenzioni, ticket-it, locker, vending) — bypassa le API e va dritto al localStorage.

Le chiavi `"uh_token"` e `"uh_session"` rimangono invariate: sono l'uso canonico del localStorage per sessioni browser.

## Goals / Non-Goals

**Goals:**
- Rimuovere le 6 funzioni localStorage da `shared/accounts.ts`: `loadRoles`, `saveRoles`, `loadSostituti`, `saveSostituti`, `loadSedi`, `saveSedi`.
- Sostituirle con funzioni async che chiamano le API backend già esistenti.
- Rimuovere i dev-helper `"uh_utenteCorrenteId"` / `"uhit_utenteCorrenteId"` dalle app Manutenzioni e Ticket IT e derivare l'utente corrente dalla sessione JWT.
- Allineare `shared/accounts.js` (legacy) con `shared/accounts.ts`.

**Non-Goals:**
- Modificare le route o il database backend (già pronti).
- Cambiare la logica di autenticazione (`uh_token`, `uh_session`).
- Aggiungere caching sofisticato (SWR/React Query) — fuori scope.
- Modificare le app `locker` e `vending` che non leggono ruoli/sedi/sostituti via `shared/accounts.ts`.

## Decisions

### D1: Sostituire le funzioni sync con async in `shared/accounts.ts`

`loadRoles()` diventa `fetchRoles(): Promise<UHRuolo[]>` che chiama `GET /api/utenti/ruoli` con il token JWT. Stessa cosa per sedi e sostituti. `saveRoles(list)` diventa `syncRoles(list): Promise<void>` che usa `POST /api/utenti/ruoli/batch`.

**Alternativa scartata**: Mantenere le funzioni sync con un wrapper che legge da un modulo-cache in memoria. Scartata perché aggiunge complessità senza benefici reali rispetto alla semplicità delle chiamate dirette.

### D2: Riutilizzare `getToken()` esistente per autenticare le chiamate

`shared/accounts.ts` ha già `getToken()` che legge `"uh_token"` dal localStorage. Tutte le nuove funzioni fetch useranno questo metodo per il header `Authorization: Bearer`.

**Alternativa scartata**: Passare il token come parametro. Scartata perché i chiamanti attuali non gestiscono il token esplicitamente.

### D3: Derivare l'utente corrente dalla sessione in Manutenzioni e Ticket IT

Il `<select>` per simulare un utente viene rimosso. L'ID utente corrente si legge da `loadSession()?.id` (già disponibile, già popolato dal backend). Questo implica che il flusso di login deve essere completato prima di usare l'app — comportamento corretto in produzione.

**Alternativa scartata**: Mantenere il selettore ma popolarlo dalla sessione come valore default non modificabile. Scartata perché lascerebbe codice morto nell'interfaccia.

### D4: Costanti chiave e funzioni `save*`/`load*` rimosse dal file legacy `accounts.js`

`shared/accounts.js` è la versione compilata/transpilata o legacy di `accounts.ts`. Viene aggiornato manualmente (o eliminato se non è più importato da nessun bundle). Le costanti `ROLES_KEY`, `SOSTITUTI_KEY`, `SEDI_KEY` vengono rimosse; `ACCOUNTS_KEY` era già no-op in `.ts` ma ancora attiva in `.js`.

## Risks / Trade-offs

- **[Risk] Latenza percepita** — Le funzioni sync erano istantanee; le chiamate async introducono latenza di rete. → Mitigation: Usare loading states già presenti nei componenti che consumano questi dati (es. `useSyncedResource` già gestisce loading/error).

- **[Risk] Dati localStorage preesistenti** — Gli utenti che hanno già dati in `"uh_ruoli"` etc. non li vedranno più dopo la migrazione. → Mitigation: Il backend è la fonte di verità; i dati nel DB (già seedati) sovrascrivono i dati locali. Nessuna migrazione dati necessaria perché i dati localStorage erano solo mock di sviluppo.

- **[Risk] Sessione mancante in Manutenzioni/Ticket IT** → Un utente non loggato vedrà un'app vuota o un redirect al login. → Mitigation: Comportamento corretto — è un pre-requisito al funzionamento dell'app, non una regressione.

- **[Risk] `shared/accounts.js` potrebbe essere importato direttamente** → Se qualche app importa il file `.js` invece di `.ts`, l'allineamento è critico. → Mitigation: Verificare i bundle/import prima di modificare il file .js.

## Migration Plan

1. Aggiornare `shared/accounts.ts`: sostituire le 6 funzioni + rimuovere le 3 costanti chiave non più necessarie.
2. Aggiornare tutti i call-site nelle app che usano `loadRoles`/`saveRoles`/`loadSedi`/`saveSedi`/`loadSostituti`/`saveSostituti` (principalmente l'app Utenti e `shared/accounts.ts` stesso).
3. Rimuovere i dev-helper `uh_utenteCorrenteId` da Manutenzioni e Ticket IT.
4. Allineare `shared/accounts.js`.
5. Verificare che non esistano altri import delle chiavi/funzioni rimosse (ricerca globale).

Nessun rollback di DB necessario — le tabelle e le route non cambiano.

## Open Questions

- `shared/accounts.js` è importato direttamente da qualche bundle di produzione o è solo un residuo? Se non è importato, può essere eliminato.
- L'app Utenti usa già `useSyncedResource` per ruoli/sedi/sostituti via API: quei call-site in `shared/accounts.ts` sono duplicati o sono usati da altre app?
