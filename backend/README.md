# Backend — Urban Homy Amministrazione

## Setup

```bash
npm install
cp .env.example .env   # configurare DATABASE_URL e JWT_SECRET
```

## Sviluppo

```bash
npm run dev
```

## Database

```bash
npm run prisma:migrate   # applica le migration in sviluppo
npm run prisma:generate  # rigenera il client Prisma dopo modifiche allo schema
```

## Seed — Account Admin

L'account amministratore è l'unico utente che può accedere tramite email + password.
Tutti gli altri utenti accedono esclusivamente tramite SSO Microsoft.

Per creare o aggiornare la password dell'admin:

```bash
ADMIN_PASSWORD=<nuova-password> npm run seed:admin
```

> Eseguire questo comando al primo deploy e ogni volta che si vuole cambiare la password admin.
> La variabile `ADMIN_PASSWORD` non deve essere committata né salvata in `.env` permanentemente.

## Variabili d'ambiente

| Variabile        | Descrizione                                      |
|------------------|--------------------------------------------------|
| `DATABASE_URL`   | Stringa di connessione SQL Server                |
| `JWT_SECRET`     | Segreto per la firma dei token JWT               |
| `ADMIN_PASSWORD` | Usata solo durante il seed admin (non a runtime) |
