## Context

The Urban Homy administrative portal consists of 7 top-level directories: a login portal (`urban-homy-home`), 5 frontend React apps (`urban-homy-progetto`, `urban-homy-locker`, `urban-homy-ticket-it`, `urban-homy-utenti`, `urban-homy-vending`), a shared auth library (`urban-homy-shared`), and a backend API embedded inside `urban-homy-progetto/backend/`. Each frontend app is independently built with esbuild, uses Tailwind via CDN, and shares a localStorage-based session through `accounts.js`. The backend is Express + Prisma + PostgreSQL serving all apps.

The current layout has no unified entry point, requires 7 separate `npm install` runs, has hardcoded Windows paths in the static server, and lacks any containerization support.

## Goals / Non-Goals

**Goals:**
- Create a new `urban-homy-amministrazionerm/` directory with a clean, navigable monorepo structure
- Preserve 1:1 functional parity — every file, every route, every behavior stays identical
- Keep sub-apps fully decoupled (each retains its own `package.json`, `src/`, `dist/`)
- Provide a `docker-compose.yml` for one-command local startup (PostgreSQL + backend + frontend)
- Provide a comprehensive English `README.md`
- Update `serve.js` to use relative paths derived from the new structure

**Non-Goals:**
- Merging dependencies into a single `package.json` or using workspace tooling (npm workspaces, turborepo, etc.)
- Refactoring any application logic, components, or API routes
- Changing environment variable handling — existing inline values stay as-is
- Setting up CI/CD pipelines
- Adding tests
- Production deployment configuration (only local Docker dev)

## Decisions

### 1. Folder structure: `apps/` + `backend/` + `shared/` + `portal/`

**Decision**: Organize into four top-level concerns:
```
urban-homy-amministrazionerm/
├── apps/
│   ├── manutenzioni/        # was urban-homy-progetto (frontend only)
│   ├── locker/              # was urban-homy-locker
│   ├── ticket-it/           # was urban-homy-ticket-it
│   ├── utenti/              # was urban-homy-utenti
│   └── vending/             # was urban-homy-vending
├── backend/                 # was urban-homy-progetto/backend
│   ├── src/
│   ├── prisma/
│   ├── scripts/
│   ├── Dockerfile
│   └── package.json
├── shared/                  # was urban-homy-shared
│   └── accounts.js
├── portal/                  # was urban-homy-home
│   ├── index.html
│   └── serve.js
├── docker-compose.yml
└── README.md
```

**Rationale**: Separating `backend/` from `apps/manutenzioni/` makes the architecture clearer — the backend serves all apps, not just manutenzioni. Using `apps/` groups all frontends. `portal/` is distinct because it's vanilla HTML (no React, no npm). `shared/` is a library, not an app.

**Alternatives considered**:
- Flat structure (all 7 dirs at root): rejected — same problem as current layout
- `packages/` naming: rejected — implies npm workspaces which we're not using
- Keeping backend inside manutenzioni: rejected — misleading, backend is shared

### 2. Copy files, don't symlink or move

**Decision**: Copy all source files into the new structure. The original directories remain untouched.

**Rationale**: The user explicitly asked to "create an eighth folder" — the new directory is additive. This also avoids breaking the currently running local setup.

### 3. Docker architecture: 3 services

**Decision**: `docker-compose.yml` defines 3 services:
- `db`: PostgreSQL 14 with a named volume for data persistence
- `backend`: Node.js container running Express API, depends on `db`, runs migrations + seed on startup
- `portal`: Node.js container running `serve.js` to serve the home page + all frontend apps as static files

**Rationale**: Minimal viable containerization. The portal service builds all frontend apps at image build time and serves them statically. The backend connects to the Postgres container. No nginx/reverse proxy needed for local dev — the portal's `serve.js` already handles routing.

**Alternatives considered**:
- Nginx for static serving: rejected — adds complexity, `serve.js` already works
- Single container for everything: rejected — violates separation of concerns
- Separate container per frontend app: rejected — overkill, they're static files

### 4. serve.js path resolution

**Decision**: Update `serve.js` to resolve paths relative to the monorepo root using `path.resolve(__dirname, '..')` as the base, then map app names to `apps/<name>/dist/`.

**Rationale**: Eliminates hardcoded paths. Works identically in Docker and local dev.

### 5. Backend startup script for Docker

**Decision**: Create an `entrypoint.sh` script that runs `npx prisma migrate deploy && node prisma/seed.js && node src/index.js`. The seed script is idempotent (deletes then re-creates).

**Rationale**: Ensures the database is always migrated and seeded when the container starts. Using `migrate deploy` (not `migrate dev`) for non-interactive container usage.

## Risks / Trade-offs

- **[Disk duplication]** → Acceptable trade-off: the new directory duplicates ~5MB of source. The original directories remain for reference and can be removed later by the user.
- **[Seed script dependency on frontend source]** → The `seed-other-apps.js` script uses `extract-seed.js` to parse `App.jsx` files from sibling directories. In the new structure, paths must be updated to point to `apps/` instead. → Mitigation: update the `SIBLINGS` path constant in the copied script.
- **[Docker build time]** → Building 5 frontend apps during `docker build` adds ~30s. → Acceptable for local dev; production would use pre-built artifacts.
- **[No hot-reload in Docker]** → The Docker setup uses `npm run build`, not `watch`. → Non-goal for this change; developers can still run outside Docker for hot-reload.
