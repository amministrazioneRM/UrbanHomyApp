## ADDED Requirements

### Requirement: Rimozione selettore utente simulato in Manutenzioni
Il sistema SHALL rimuovere dalla sidebar dell'app Manutenzioni (`apps/manutenzioni/src/App.tsx`) il `<select>` che permette di cambiare l'utente corrente simulato. L'ID utente corrente MUST essere derivato esclusivamente da `loadSession()?.id` (sessione JWT reale). La chiave `"uh_utenteCorrenteId"` MUST essere rimossa da ogni lettura e scrittura localStorage nell'app.

#### Scenario: Utente autenticato accede all'app
- **WHEN** un utente con sessione JWT valida apre l'app Manutenzioni
- **THEN** l'app usa `loadSession().id` come ID utente corrente, senza mostrare nessun selettore di simulazione

#### Scenario: Sessione assente
- **WHEN** `loadSession()` restituisce `null`
- **THEN** l'app mostra uno stato di errore o redirect al login; non usa nessun ID di fallback

#### Scenario: Verifica rimozione chiave localStorage
- **WHEN** viene eseguita una ricerca per `"uh_utenteCorrenteId"` nella codebase
- **THEN** non deve esistere nessuna occorrenza attiva

### Requirement: Rimozione selettore utente simulato in Ticket IT
Il sistema SHALL rimuovere dalla sidebar dell'app Ticket IT (`apps/ticket-it/src/App.tsx`) il `<select>` che permette di cambiare l'utente corrente simulato. L'ID utente corrente MUST essere derivato esclusivamente da `loadSession()?.id`. La chiave `"uhit_utenteCorrenteId"` MUST essere rimossa da ogni lettura e scrittura localStorage nell'app.

#### Scenario: Utente autenticato accede all'app
- **WHEN** un utente con sessione JWT valida apre l'app Ticket IT
- **THEN** l'app usa `loadSession().id` come ID utente corrente, senza mostrare nessun selettore di simulazione

#### Scenario: Sessione assente
- **WHEN** `loadSession()` restituisce `null`
- **THEN** l'app mostra uno stato di errore o redirect al login

#### Scenario: Verifica rimozione chiave localStorage
- **WHEN** viene eseguita una ricerca per `"uhit_utenteCorrenteId"` nella codebase
- **THEN** non deve esistere nessuna occorrenza attiva
