## 1. Scaffold monorepo directory structure

- [x] 1.1 Create the root directory `urban-homy-amministrazionerm/` with subdirectories: `apps/manutenzioni/`, `apps/locker/`, `apps/ticket-it/`, `apps/utenti/`, `apps/vending/`, `backend/`, `shared/`, `portal/`

## 2. Copy frontend apps into apps/

- [x] 2.1 Copy `urban-homy-progetto/src/`, `urban-homy-progetto/package.json`, `urban-homy-progetto/dist/` into `apps/manutenzioni/` (exclude `backend/` and `node_modules/`)
- [x] 2.2 Copy `urban-homy-locker/src/`, `urban-homy-locker/package.json`, `urban-homy-locker/dist/` into `apps/locker/` (exclude `node_modules/`)
- [x] 2.3 Copy `urban-homy-ticket-it/src/`, `urban-homy-ticket-it/package.json`, `urban-homy-ticket-it/dist/` into `apps/ticket-it/` (exclude `node_modules/`)
- [x] 2.4 Copy `urban-homy-utenti/src/`, `urban-homy-utenti/package.json`, `urban-homy-utenti/dist/` into `apps/utenti/` (exclude `node_modules/`)
- [x] 2.5 Copy `urban-homy-vending/src/`, `urban-homy-vending/package.json`, `urban-homy-vending/dist/` into `apps/vending/` (exclude `node_modules/`)

## 3. Copy backend

- [x] 3.1 Copy `urban-homy-progetto/backend/src/`, `urban-homy-progetto/backend/prisma/`, `urban-homy-progetto/backend/scripts/`, `urban-homy-progetto/backend/package.json`, `urban-homy-progetto/backend/.env.example` into `backend/` (exclude `node_modules/`)
- [x] 3.2 Update `backend/scripts/seed-other-apps.js` — change the `SIBLINGS` path constant to resolve to `../apps` instead of the old sibling directory layout

## 4. Copy shared library and portal

- [x] 4.1 Copy `urban-homy-shared/accounts.js` into `shared/`
- [x] 4.2 Copy `urban-homy-home/index.html` and `urban-homy-home/README.md` into `portal/`
- [x] 4.3 Create `portal/serve.js` with updated path mappings: use `path.resolve(__dirname, '..')` as base, map app names to `apps/<name>/dist/` and `shared` to `shared/`

## 5. Docker infrastructure

- [x] 5.1 Create `backend/Dockerfile` — Node.js 18 base, copy source, install deps, generate Prisma client, include entrypoint script
- [x] 5.2 Create `backend/entrypoint.sh` — runs `npx prisma migrate deploy`, `node prisma/seed.js`, `node scripts/seed-other-apps.js`, `node scripts/hash-passwords.js`, then `node src/index.js`
- [x] 5.3 Create `portal/Dockerfile` — Node.js 18 base, copy all apps + shared + portal, install deps for each app, build each app, run `serve.js` as entrypoint
- [x] 5.4 Create `docker-compose.yml` at monorepo root with 3 services: `db` (PostgreSQL 14, named volume, port 5432), `backend` (build from `backend/`, port 4000, depends on db), `portal` (build from context `.` with `portal/Dockerfile`, port 5173, depends on backend)

## 6. English README

- [x] 6.1 Create `README.md` at monorepo root in English with: project overview, tech stack table, folder structure tree, all 6 applications with features, Docker startup instructions (`docker compose up --build`), local dev instructions (manual setup), default credentials table, API endpoints summary

## 7. Verification

- [x] 7.1 Verify the new directory structure matches the spec (all directories and files present)
- [x] 7.2 Verify `serve.js` path mappings are correct by inspecting the file
- [x] 7.3 Verify `seed-other-apps.js` path update points to `apps/` correctly
