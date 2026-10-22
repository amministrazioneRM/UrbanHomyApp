## ADDED Requirements

### Requirement: Lettura ruoli tramite API
Il sistema SHALL sostituire `loadRoles()` in `shared/accounts.ts` con una funzione async `fetchRoles(): Promise<UHRuolo[]>` che chiama `GET /api/utenti/ruoli` con il token JWT nell'header `Authorization: Bearer`. La funzione MUST restituire un array vuoto in caso di errore o risposta non valida, senza lanciare eccezioni verso il chiamante.

#### Scenario: Chiamata riuscita
- **WHEN** il token JWT è valido e il backend risponde con HTTP 200
- **THEN** la funzione restituisce l'array di `UHRuolo[]` ricevuto dalla risposta JSON

#### Scenario: Token assente o scaduto
- **WHEN** `getToken()` restituisce `null` oppure il backend risponde con HTTP 401
- **THEN** la funzione restituisce `[]` senza propagare l'errore

#### Scenario: Errore di rete
- **WHEN** la chiamata HTTP fallisce per problemi di connessione
- **THEN** la funzione restituisce `[]` e logga l'errore in console

### Requirement: Scrittura ruoli tramite API
Il sistema SHALL sostituire `saveRoles(list)` in `shared/accounts.ts` con una funzione async `syncRoles(list: UHRuolo[]): Promise<void>` che chiama `POST /api/utenti/ruoli/batch` per sincronizzare l'intero array. La funzione MUST usare il token JWT per autenticare la richiesta.

#### Scenario: Salvataggio riuscito
- **WHEN** il token è valido e la lista viene inviata
- **THEN** il backend persiste i ruoli e risponde con HTTP 200; nessun dato viene scritto in localStorage

#### Scenario: Risposta di errore
- **WHEN** il backend risponde con un errore HTTP
- **THEN** la funzione logga l'errore e non lancia eccezioni verso il chiamante

### Requirement: Rimozione costante `ROLES_KEY` e dipendenze localStorage
Il sistema SHALL rimuovere la costante `ROLES_KEY = "uh_ruoli"` da `shared/accounts.ts` e da `shared/accounts.js`. Nessuna delle funzioni relative ai ruoli MUST accedere a `localStorage` dopo questa modifica.

#### Scenario: Verifica assenza localStorage nei ruoli
- **WHEN** viene eseguita una ricerca globale per `"uh_ruoli"` o `ROLES_KEY` nella codebase
- **THEN** non deve esistere nessuna occorrenza al di fuori di commenti o test
