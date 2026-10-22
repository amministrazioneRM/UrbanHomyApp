## MODIFIED Requirements

### Requirement: Rimozione password dai dati default client-side
Il sistema SHALL mantenere i `DEFAULT_ACCOUNTS` in `shared/accounts.ts` senza password in chiaro. Il tipo `UHAccount` già prevede `password` come opzionale; i valori di default NON devono includere il campo `password`. Il file `shared/accounts.js` MUST essere allineato con `shared/accounts.ts`: la costante `ACCOUNTS_KEY = "uh_accounts"` e le funzioni `loadAccounts`/`saveAccounts` che ancora scrivono in localStorage nel file `.js` MUST essere convertite in no-op (o il file eliminato se non importato da nessun bundle).

#### Scenario: Caricamento accounts da localStorage vuoto
- **WHEN** il localStorage non contiene dati utente e vengono caricati i DEFAULT_ACCOUNTS
- **THEN** nessun account di default contiene il campo `password`

#### Scenario: `shared/accounts.js` non usa localStorage per gli account
- **WHEN** viene eseguita una ricerca per `localStorage` nel file `shared/accounts.js`
- **THEN** le uniche occorrenze consentite sono relative a `uh_token` e `uh_session`; nessuna occorrenza per `uh_accounts`, `uh_ruoli`, `uh_sedi`, `uh_sostituti`
