## 1. Migrazione ruoli in `shared/accounts.ts`

- [x] 1.1 Rimuovere la costante `ROLES_KEY = "uh_ruoli"` da `shared/accounts.ts`
- [x] 1.2 Sostituire `loadRoles()` con `fetchRoles(): Promise<UHRuolo[]>` che chiama `GET /api/utenti/ruoli` usando `getToken()`
- [x] 1.3 Sostituire `saveRoles(list)` con `syncRoles(list: UHRuolo[]): Promise<void>` che chiama `POST /api/utenti/ruoli/batch`
- [x] 1.4 Aggiornare tutti i call-site di `loadRoles` / `saveRoles` nella codebase (ricerca globale) per usare le nuove funzioni async

## 2. Migrazione sedi in `shared/accounts.ts`

- [x] 2.1 Rimuovere la costante `SEDI_KEY = "uh_sedi"` e l'array `DEFAULT_SEDI` da `shared/accounts.ts`
- [x] 2.2 Sostituire `loadSedi()` con `fetchSedi(): Promise<UHSede[]>` che chiama `GET /api/utenti/sedi` usando `getToken()`
- [x] 2.3 Sostituire `saveSedi(list)` con `syncSedi(list: UHSede[]): Promise<void>` che chiama `POST /api/utenti/sedi/batch`
- [x] 2.4 Aggiornare tutti i call-site di `loadSedi` / `saveSedi` nella codebase per usare le nuove funzioni async

## 3. Migrazione sostituti in `shared/accounts.ts`

- [x] 3.1 Rimuovere la costante `SOSTITUTI_KEY = "uh_sostituti"` da `shared/accounts.ts`
- [x] 3.2 Sostituire `loadSostituti()` con `fetchSostituti(): Promise<UHSostituto[]>` che chiama `GET /api/utenti/sostituti` usando `getToken()`
- [x] 3.3 Sostituire `saveSostituti(list)` con `syncSostituti(list: UHSostituto[]): Promise<void>` che chiama `POST /api/utenti/sostituti/batch`
- [x] 3.4 Aggiornare tutti i call-site di `loadSostituti` / `saveSostituti` nella codebase per usare le nuove funzioni async

## 4. Rimozione selettore utente simulato in Manutenzioni

- [x] 4.1 Rimuovere lo stato `utenteCorrenteId` inizializzato da `localStorage.getItem("uh_utenteCorrenteId")` in `apps/manutenzioni/src/App.tsx`
- [x] 4.2 Rimuovere il `<select>` per la simulazione utente dalla sidebar di Manutenzioni
- [x] 4.3 Rimuovere la scrittura `localStorage.setItem("uh_utenteCorrenteId", ...)` dall'handler del `<select>`
- [x] 4.4 Sostituire ogni uso di `utenteCorrenteId` con `loadSession()?.id` (oppure gestire il caso `null` con redirect/errore)

## 5. Rimozione selettore utente simulato in Ticket IT

- [x] 5.1 Rimuovere lo stato `utenteCorrenteId` inizializzato da `localStorage.getItem("uhit_utenteCorrenteId")` in `apps/ticket-it/src/App.tsx`
- [x] 5.2 Rimuovere il `<select>` per la simulazione utente dalla sidebar di Ticket IT
- [x] 5.3 Rimuovere la scrittura `localStorage.setItem("uhit_utenteCorrenteId", ...)` dall'handler del `<select>`
- [x] 5.4 Sostituire ogni uso di `utenteCorrenteId` con `loadSession()?.id` (oppure gestire il caso `null` con redirect/errore)

## 6. Allineamento file legacy `shared/accounts.js`

- [x] 6.1 Verificare se `shared/accounts.js` è importato direttamente da qualche bundle (ricerca globale per `accounts.js`)
- [x] 6.2 Se importato: rimuovere `ACCOUNTS_KEY`, `ROLES_KEY`, `SOSTITUTI_KEY`, `SEDI_KEY` e le relative funzioni `loadAccounts`/`saveAccounts`/`loadRoles`/`saveRoles`/`loadSostituti`/`saveSostituti`/`loadSedi`/`saveSedi` basate su localStorage
- [x] 6.3 Se non importato: eliminare il file `shared/accounts.js` e rimuovere ogni riferimento

## 7. Verifica finale

- [x] 7.1 Eseguire una ricerca globale per `"uh_ruoli"`, `"uh_sedi"`, `"uh_sostituti"`, `"uh_utenteCorrenteId"`, `"uhit_utenteCorrenteId"` e verificare zero occorrenze attive
- [x] 7.2 Verificare che `"uh_token"` e `"uh_session"` siano le sole chiavi localStorage rimaste nel progetto
- [x] 7.3 Testare il flusso login → lettura ruoli/sedi/sostituti via API nelle app interessate
- [x] 7.4 Verificare che le app Manutenzioni e Ticket IT mostrino correttamente l'utente dalla sessione JWT
