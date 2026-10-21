## ADDED Requirements

### Requirement: Solo l'admin locale può autenticarsi con password
Il sistema SHALL permettere il login con email + password (route `POST /api/auth/login`) esclusivamente agli account che hanno il campo `password` non null nel database. Se l'account trovato ha `password = NULL`, la route MUST rispondere con HTTP 403 e un messaggio esplicativo.

#### Scenario: Login admin con credenziali corrette
- **WHEN** viene inviata una richiesta `POST /api/auth/login` con email e password dell'account admin
- **THEN** il sistema verifica la password con bcrypt, emette un JWT valido e risponde con HTTP 200 contenente `token` e `account`

#### Scenario: Login con account SSO-only (password null)
- **WHEN** viene inviata una richiesta `POST /api/auth/login` con email di un utente che non ha password nel DB
- **THEN** il sistema risponde con HTTP 403 e messaggio "Questo account accede tramite SSO Microsoft"

#### Scenario: Login con credenziali errate (account admin)
- **WHEN** viene inviata una richiesta `POST /api/auth/login` con email dell'admin ma password sbagliata
- **THEN** il sistema risponde con HTTP 401 e messaggio "Credenziali non valide"

#### Scenario: Login con email inesistente
- **WHEN** viene inviata una richiesta `POST /api/auth/login` con email non presente nel DB
- **THEN** il sistema risponde con HTTP 401 e messaggio "Credenziali non valide"

### Requirement: Password admin gestita tramite script di seed
Il sistema SHALL fornire uno script (`backend/src/seed-admin.ts`) che crea o aggiorna l'account amministratore con una password bcrypt. La password SHALL essere letta dalla variabile d'ambiente `ADMIN_PASSWORD`. Lo script NON DEVE essere esposto come endpoint API.

#### Scenario: Esecuzione seed con variabile d'ambiente impostata
- **WHEN** lo script `seed-admin.ts` viene eseguito con `ADMIN_PASSWORD` definita nell'ambiente
- **THEN** lo script effettua upsert dell'account admin hashando la password e risponde con successo senza esporre l'hash

#### Scenario: Esecuzione seed senza variabile d'ambiente
- **WHEN** lo script `seed-admin.ts` viene eseguito senza `ADMIN_PASSWORD`
- **THEN** lo script termina con errore esplicativo senza modificare il database
