## ADDED Requirements

### Requirement: Utenti non-admin accedono esclusivamente tramite SSO Microsoft
Il sistema SHALL permettere l'accesso tramite `POST /api/auth/sso` a tutti gli account presenti nel database, indipendentemente dalla presenza del campo `password`. Gli account senza password (SSO-only) non possono autenticarsi tramite `POST /api/auth/login`.

#### Scenario: Login SSO utente non-admin autorizzato
- **WHEN** viene inviata una richiesta `POST /api/auth/sso` con un access token Microsoft valido per un utente la cui email è presente in `utenti_accounts`
- **THEN** il sistema verifica l'identità tramite Microsoft Graph, emette un JWT interno e risponde con HTTP 200 contenente `token` e `account`

#### Scenario: Login SSO con email non censita nel DB
- **WHEN** viene inviata una richiesta `POST /api/auth/sso` con un access token Microsoft valido ma email non presente in `utenti_accounts`
- **THEN** il sistema risponde con HTTP 403 e messaggio "Account Microsoft non autorizzato su nessuna applicazione"

#### Scenario: Login SSO con token Microsoft non valido
- **WHEN** viene inviata una richiesta `POST /api/auth/sso` con access token Microsoft scaduto o non valido
- **THEN** il sistema risponde con HTTP 401 e messaggio "Token Microsoft non valido"

### Requirement: Campo password nullable nel database
Il sistema SHALL mantenere la colonna `password` in `utenti_accounts` come nullable. Gli account creati dall'applicazione (utenti non-admin) MUST avere `password = NULL`. L'unico account con password non-null è l'admin locale.

#### Scenario: Creazione utente non-admin via API
- **WHEN** viene creato un nuovo account tramite `POST /api/utenti/accounts` con `ruoloGlobale = "Utente"`
- **THEN** il record salvato in DB ha `password = NULL`

#### Scenario: Migrazione account esistenti
- **WHEN** viene eseguita la migration di aggiornamento schema
- **THEN** tutti gli account con `ruoloGlobale != "Amministratore"` hanno `password` impostato a `NULL`
