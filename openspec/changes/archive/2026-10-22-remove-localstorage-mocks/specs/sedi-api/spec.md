## ADDED Requirements

### Requirement: Lettura sedi tramite API
Il sistema SHALL sostituire `loadSedi()` in `shared/accounts.ts` con una funzione async `fetchSedi(): Promise<UHSede[]>` che chiama `GET /api/utenti/sedi` con il token JWT. La funzione MUST eliminare il fallback su `DEFAULT_SEDI` hardcoded: se il backend non risponde o restituisce un array vuoto, la funzione restituisce `[]`.

#### Scenario: Chiamata riuscita con dati presenti
- **WHEN** il backend risponde con HTTP 200 e un array di sedi
- **THEN** la funzione restituisce l'array ricevuto, senza mai leggere `localStorage`

#### Scenario: Backend risponde con array vuoto
- **WHEN** il backend risponde con HTTP 200 e `[]`
- **THEN** la funzione restituisce `[]`; il sistema non usa `DEFAULT_SEDI` come fallback

#### Scenario: Errore di rete o autenticazione
- **WHEN** la chiamata fallisce per qualsiasi motivo
- **THEN** la funzione restituisce `[]` e logga l'errore

### Requirement: Scrittura sedi tramite API
Il sistema SHALL sostituire `saveSedi(list)` con una funzione async `syncSedi(list: UHSede[]): Promise<void>` che chiama `POST /api/utenti/sedi/batch`. Nessun dato delle sedi MUST essere scritto in localStorage.

#### Scenario: Sincronizzazione riuscita
- **WHEN** il token è valido e la lista sedi è inviata al backend
- **THEN** i dati sono persistiti nel DB; localStorage non viene toccato

### Requirement: Rimozione costante `SEDI_KEY` e `DEFAULT_SEDI`
Il sistema SHALL rimuovere la costante `SEDI_KEY = "uh_sedi"` e l'array `DEFAULT_SEDI` hardcoded da `shared/accounts.ts` e `shared/accounts.js`. Le sedi MUST provenire esclusivamente dal backend.

#### Scenario: Verifica assenza mock hardcoded
- **WHEN** viene eseguita una ricerca globale per `"uh_sedi"`, `SEDI_KEY` o `DEFAULT_SEDI`
- **THEN** non deve esistere nessuna occorrenza attiva nella codebase
