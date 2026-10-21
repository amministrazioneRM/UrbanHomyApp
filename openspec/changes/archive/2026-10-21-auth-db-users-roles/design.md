## Context

Il progetto ha un backend Node/Express con Prisma (SQL Server) e JWT. Sono già presenti:
- `POST /api/auth/login` — verifica email + password bcrypt dal DB
- `POST /api/auth/sso` — valida un access token Microsoft Graph e rilascia JWT interno
- `GET /api/auth/me` — restituisce l'account corrente dal token

Il modello `UtentiAccount` (tabella `utenti_accounts`) ha attualmente `password` come colonna `NOT NULL String`. Tutti gli utenti hanno una password hashata, inclusi quelli che dovrebbero accedere solo tramite SSO Microsoft.

Il client-side (`shared/accounts.ts`) gestisce ancora una copia locale in localStorage dei dati utente come fallback/cache, con password in chiaro hardcodate negli `DEFAULT_ACCOUNTS`. Questo non è un rischio di sicurezza vero (è solo lato client e i token JWT sono firmati lato server), ma è un debito tecnico da allineare.

## Goals / Non-Goals

**Goals:**
- Solo l'utente con `ruoloGlobale = "Amministratore"` (admin applicativo) ha una password nel DB e può autenticarsi via `POST /api/auth/login`
- Tutti gli altri utenti hanno `password = NULL` e possono autenticarsi **esclusivamente** via `POST /api/auth/sso`
- La route `/login` rifiuta account senza password (cioè non è l'admin locale)
- La route `/sso` rifiuta account con password non null se volessimo bloccare l'admin dal login SSO (decisione: NON bloccato, admin può fare SSO se il suo account Microsoft esiste)
- Il form di gestione utenti nell'app non espone più il campo password
- La migrazione DB aggiorna la colonna a `NULL`-able e azzera le password degli utenti non-admin
- Uno script di seed/migration imposta la password bcrypt dell'admin

**Non-Goals:**
- Gestione multi-admin (rimane un solo account con `ruoloGlobale = "Amministratore"`)
- Reset password self-service
- Cambio password dall'interfaccia applicativa
- Bloccare completamente l'admin dal login SSO

## Decisions

### 1. Campo `password` nullable nel DB

**Decisione**: `password String?` in Prisma (colonna `NVARCHAR NULL` in SQL Server).

**Rationale**: Distingue nativamente gli account SSO-only (null) dall'admin locale (non-null). Evita sentinel value come stringa vuota o hash fittizio.

**Alternativa scartata**: Colonna booleana `ssoOnly` — più espressiva ma ridondante se già usiamo null come indicatore.

### 2. Guardrail in `/login`

**Decisione**: Se `account.password` è null, la route risponde `403 Forbidden` con messaggio "Questo account accede tramite SSO Microsoft".

**Rationale**: Impedisce che utenti SSO tentino il login con password (che comunque fallirebbe su `bcrypt.compare`), restituendo un errore chiaro invece di "credenziali non valide".

### 3. Nessun guardrail aggiuntivo in `/sso`

**Decisione**: La route SSO accetta qualsiasi account trovato per email, indipendentemente dalla presenza di password.

**Rationale**: L'admin potrebbe avere un account Microsoft e voler usare SSO per comodità. Non c'è motivo di bloccarlo. Il requisito è solo che gli utenti normali NON possano usare `/login`, non che l'admin non possa usare `/sso`.

### 4. Password admin gestita fuori dal CRUD applicativo

**Decisione**: La password dell'admin è impostata tramite uno script di seed (`backend/src/seed-admin.ts`) eseguito via `ts-node` o come step di deploy, non tramite API.

**Rationale**: Esporre una route per impostare/cambiare la password admin nell'app richiederebbe autenticazione chicken-and-egg al primo avvio. Lo script di seed è più semplice e sicuro per un ambiente monoamministratore.

**Alternativa scartata**: Variabile d'ambiente `ADMIN_PASSWORD` letta all'avvio e hashata al volo — più fragile (password in env plain text) e reinizializza ad ogni restart.

### 5. Form utenti: campo password rimosso

**Decisione**: Nell'app Utenti, il form di creazione/modifica rimuove completamente il campo password. L'API `POST/PUT /api/utenti/accounts` ignora (o rifiuta) eventuali campi `password` nel body.

**Rationale**: Gli utenti non-admin non hanno password; mostrare il campo crea confusione e aspettative errate.

## Risks / Trade-offs

- **[Risk] Admin bloccato fuori se dimentica la password** → Mitigation: lo script `seed-admin.ts` può essere rieseguito con una nuova password; documentare questo processo per l'operatore
- **[Risk] Migration fallisce su dati esistenti** → Mitigation: la migration prima azzera le password dei non-admin (`UPDATE ... SET password = NULL WHERE ruolo_globale != 'Amministratore'`), poi altera la colonna; eseguire in transazione
- **[Risk] `shared/accounts.ts` DEFAULT_ACCOUNTS con password in chiaro** → non è un rischio di sicurezza (codice client, no hash), ma è un debito tecnico; le password vanno rimosse dai default per consistenza
- **[Risk] App che legge `account.password` esplodono con null** → Mitigation: `requireAuth` già fa `const { password: _pw, ...safeAccount }` prima di attaccare l'account a `req`; nessuna route espone la password al client

## Migration Plan

1. **Preparare script seed admin**: `backend/src/seed-admin.ts` che fa upsert dell'account admin con password bcrypt
2. **Aggiornare schema Prisma**: `password String?`
3. **Creare migration SQL**:
   - `ALTER TABLE utenti_accounts ALTER COLUMN password NVARCHAR(MAX) NULL`
   - `UPDATE utenti_accounts SET password = NULL WHERE ruolo_globale != 'Amministratore'`
4. **Aggiornare route `/login`**: aggiungere guardrail password null
5. **Aggiornare app Utenti**: rimuovere campo password dai form
6. **Aggiornare `shared/accounts.ts`**: rimuovere password dai `DEFAULT_ACCOUNTS`
7. **Eseguire `seed-admin.ts`** in ambiente di staging/produzione
8. **Rollback**: la colonna torna `NOT NULL` ripristinando il backup; nessuna modifica applicativa è distruttiva

## Open Questions

- La password dell'admin deve essere configurabile da variabile d'ambiente al seed, oppure hardcodata nello script con un valore di default da cambiare?
  - Raccomandazione: variabile d'ambiente `ADMIN_PASSWORD` usata solo dallo script di seed (non a runtime), mai committata
- L'admin deve essere creato automaticamente al primo avvio del backend se non esiste, oppure solo tramite script esplicito?
  - Raccomandazione: solo tramite script esplicito, per evitare comportamenti imprevisti in produzione
