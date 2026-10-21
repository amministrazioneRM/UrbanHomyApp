## 1. Database — Schema e Migration

- [x] 1.1 Aggiornare `backend/prisma/schema.prisma`: campo `password` su `UtentiAccount` da `String` a `String?`
- [x] 1.2 Creare migration `20261021000000_password_nullable`: `ALTER TABLE utenti_accounts ALTER COLUMN password NVARCHAR(MAX) NULL` + `UPDATE utenti_accounts SET password = NULL WHERE ruolo_globale != 'Amministratore'`
- [x] 1.3 Verificare che la migration venga accettata da Prisma (`npx prisma migrate deploy` o `prisma db push` in dev)

## 2. Backend — Seed admin

- [x] 2.1 Creare script `backend/src/seed-admin.ts` che legge `ADMIN_PASSWORD` dall'env, hasha con bcrypt e fa upsert dell'account admin (email: `admin@urbanhomy.it`, `ruoloGlobale: "Amministratore"`)
- [x] 2.2 Aggiungere script `"seed:admin"` in `backend/package.json` (es. `tsx src/seed-admin.ts`)
- [x] 2.3 Documentare nel README del backend come eseguire il seed al primo deploy

## 3. Backend — Route auth

- [x] 3.1 Aggiornare `backend/src/routes/auth.ts` route `POST /login`: dopo aver trovato l'account, se `account.password === null`, rispondere con HTTP 403 "Questo account accede tramite SSO Microsoft"
- [x] 3.2 Verificare che `bcrypt.compare` non venga chiamato quando `password` è null (evitare errori runtime su parametro null)
- [x] 3.3 Verificare che la route `POST /sso` non necessiti modifiche (nessun guardrail aggiuntivo per account con password, come da design)

## 4. Backend — CRUD utenti

- [x] 4.1 Aggiornare la route `POST /api/utenti/accounts` in `backend/src/routes/crud.ts`: rimuovere qualsiasi gestione/hashing del campo `password` ricevuto nel body; il campo `password` nel record deve essere sempre `null` (o undefined) alla creazione
- [x] 4.2 Aggiornare la route `PUT /api/utenti/accounts/:id`: stessa logica — ignorare eventuali campi `password` nel body
- [x] 4.3 Aggiornare il tipo TypeScript del body di creazione/modifica account per escludere `password`

## 5. Frontend — App Utenti (form account)

- [x] 5.1 Trovare il componente form di creazione/modifica utente nell'app Utenti
- [x] 5.2 Rimuovere il campo input password dal form
- [x] 5.3 Rimuovere la validazione del campo password (se presente)
- [x] 5.4 Verificare che la submit del form non invii il campo `password` all'API

## 6. Client-side — shared/accounts.ts

- [x] 6.1 Rimuovere le password in chiaro dagli oggetti in `DEFAULT_ACCOUNTS` (righe 191-226 circa)
- [x] 6.2 Verificare che il tipo `UHAccount` abbia `password?: string` (già opzionale — confermare)
- [x] 6.3 Verificare che nessun altro punto in `shared/accounts.ts` tenti di leggere o scrivere il campo `password` in modo non null-safe

## 7. Verifica end-to-end

- [ ] 7.1 Eseguire il seed admin in ambiente di sviluppo
- [ ] 7.2 Testare login admin via `/api/auth/login` con le credenziali corrette → JWT emesso
- [ ] 7.3 Testare login di un utente SSO-only via `/api/auth/login` → HTTP 403
- [ ] 7.4 Testare login SSO di un utente non-admin via `/api/auth/sso` → JWT emesso
- [ ] 7.5 Testare creazione utente dall'app: il record nel DB ha `password = NULL`
- [x] 7.6 Verificare che `GET /api/auth/me` non esponga mai il campo `password` nella risposta
