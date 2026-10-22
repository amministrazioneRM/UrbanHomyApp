### Requirement: Lettura sostituti tramite API
Il sistema SHALL sostituire `loadSostituti()` in `shared/accounts.ts` con una funzione async `fetchSostituti(): Promise<UHSostituto[]>` che chiama `GET /api/utenti/sostituti` con il token JWT. La funzione MUST restituire `[]` in caso di errore senza propagare eccezioni.

#### Scenario: Chiamata riuscita
- **WHEN** il token è valido e il backend risponde con HTTP 200
- **THEN** la funzione restituisce l'array di sostituti ricevuto, senza leggere localStorage

#### Scenario: Nessun sostituto configurato
- **WHEN** il backend risponde con `[]`
- **THEN** la funzione restituisce `[]`

#### Scenario: Errore HTTP
- **WHEN** il backend risponde con errore o la rete non è disponibile
- **THEN** la funzione restituisce `[]` e logga l'errore

### Requirement: Scrittura sostituti tramite API
Il sistema SHALL sostituire `saveSostituti(list)` con una funzione async `syncSostituti(list: UHSostituto[]): Promise<void>` che chiama `POST /api/utenti/sostituti/batch`. Nessun dato delle sostituzioni MUST essere scritto in localStorage.

#### Scenario: Sincronizzazione riuscita
- **WHEN** il token è valido e la lista è inviata
- **THEN** i dati sono persistiti nel DB; localStorage non viene toccato

### Requirement: Rimozione costante `SOSTITUTI_KEY`
Il sistema SHALL rimuovere la costante `SOSTITUTI_KEY = "uh_sostituti"` da `shared/accounts.ts` e `shared/accounts.js`.

#### Scenario: Verifica assenza localStorage nei sostituti
- **WHEN** viene eseguita una ricerca globale per `"uh_sostituti"` o `SOSTITUTI_KEY`
- **THEN** non deve esistere nessuna occorrenza attiva nella codebase
