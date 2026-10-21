## MODIFIED Requirements

### Requirement: Form creazione/modifica account senza campo password
Il sistema SHALL escludere il campo password dall'interfaccia di gestione utenti. L'API `POST /api/utenti/accounts` e `PUT /api/utenti/accounts/:id` MUST ignorare qualsiasi campo `password` ricevuto nel body della richiesta. Il form di creazione/modifica utente nell'app SHALL raccogliere esclusivamente: nome, email e ruolo globale.

#### Scenario: Creazione utente senza password
- **WHEN** l'amministratore crea un nuovo utente inserendo nome, email e ruolo
- **THEN** il sistema salva il record con `password = NULL` e risponde con HTTP 201; il campo password non è mai richiesto né accettato

#### Scenario: Modifica utente esistente
- **WHEN** l'amministratore modifica un utente esistente
- **THEN** il sistema aggiorna nome, email e ruolo senza toccare il campo password (rimane NULL o invariato per l'admin)

#### Scenario: Tentativo di impostare password tramite API CRUD
- **WHEN** viene inviata una richiesta `POST /api/utenti/accounts` o `PUT /api/utenti/accounts/:id` con un campo `password` nel body
- **THEN** il sistema ignora il campo `password` e salva gli altri campi normalmente; la password non viene mai aggiornata tramite questa route

## ADDED Requirements

### Requirement: Rimozione password dai dati default client-side
Il sistema SHALL mantenere i `DEFAULT_ACCOUNTS` in `shared/accounts.ts` senza password in chiaro. Il tipo `UHAccount` già prevede `password` come opzionale; i valori di default NON devono includere il campo `password`.

#### Scenario: Caricamento accounts da localStorage vuoto
- **WHEN** il localStorage non contiene dati utente e vengono caricati i DEFAULT_ACCOUNTS
- **THEN** nessun account di default contiene il campo `password`
