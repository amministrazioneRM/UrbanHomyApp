## ADDED Requirements

### Requirement: Monorepo root directory
The system SHALL create a new top-level directory named `urban-homy-amministrazionerm/` at the project root containing the entire application consolidated into a single unified structure.

#### Scenario: Directory exists after creation
- **WHEN** the change is applied
- **THEN** a directory `urban-homy-amministrazionerm/` SHALL exist at the project root

### Requirement: Four top-level concern directories
The monorepo root SHALL contain exactly four application directories: `apps/`, `backend/`, `shared/`, and `portal/`.

#### Scenario: Top-level structure
- **WHEN** listing the contents of `urban-homy-amministrazionerm/`
- **THEN** the directories `apps/`, `backend/`, `shared/`, and `portal/` SHALL exist
- **THEN** `docker-compose.yml` and `README.md` SHALL exist at the root

### Requirement: Frontend apps in apps/ directory
Each frontend sub-application SHALL reside in its own subdirectory under `apps/` with the names: `manutenzioni/`, `locker/`, `ticket-it/`, `utenti/`, `vending/`.

#### Scenario: App directory mapping
- **WHEN** listing `apps/`
- **THEN** `manutenzioni/` SHALL contain the contents of the original `urban-homy-progetto/` frontend (excluding `backend/`)
- **THEN** `locker/` SHALL contain the contents of the original `urban-homy-locker/`
- **THEN** `ticket-it/` SHALL contain the contents of the original `urban-homy-ticket-it/`
- **THEN** `utenti/` SHALL contain the contents of the original `urban-homy-utenti/`
- **THEN** `vending/` SHALL contain the contents of the original `urban-homy-vending/`

#### Scenario: Each app retains its own package.json
- **WHEN** inspecting any app directory under `apps/`
- **THEN** it SHALL contain its own `package.json`, `src/`, and `dist/` directories
- **THEN** the `package.json` SHALL be identical to the original (no dependency merging)

### Requirement: Backend extracted to root level
The backend SHALL reside at `backend/` (root level), extracted from `urban-homy-progetto/backend/`.

#### Scenario: Backend contents
- **WHEN** listing `backend/`
- **THEN** it SHALL contain `src/`, `prisma/`, `scripts/`, `package.json`, and a `Dockerfile`
- **THEN** all source files SHALL be identical to the originals in `urban-homy-progetto/backend/`

### Requirement: Shared library at root level
The shared auth library SHALL reside at `shared/` containing `accounts.js`.

#### Scenario: Shared library contents
- **WHEN** listing `shared/`
- **THEN** it SHALL contain `accounts.js` identical to the original `urban-homy-shared/accounts.js`

### Requirement: Portal at root level
The login portal SHALL reside at `portal/` containing the home page and static server.

#### Scenario: Portal contents
- **WHEN** listing `portal/`
- **THEN** it SHALL contain `index.html` and `serve.js`
- **THEN** `index.html` SHALL be identical to the original `urban-homy-home/index.html`

### Requirement: serve.js uses relative paths
The `portal/serve.js` SHALL resolve all app paths relative to the monorepo root, not using hardcoded absolute paths.

#### Scenario: Path resolution
- **WHEN** `serve.js` maps app routes to filesystem paths
- **THEN** it SHALL use `path.resolve(__dirname, '..')` as the base directory
- **THEN** `manutenzioni` SHALL map to `apps/manutenzioni/dist/`
- **THEN** `ticket-it` SHALL map to `apps/ticket-it/dist/`
- **THEN** `utenti` SHALL map to `apps/utenti/dist/`
- **THEN** `locker` SHALL map to `apps/locker/dist/`
- **THEN** `vending` SHALL map to `apps/vending/dist/`
- **THEN** `shared` SHALL map to `shared/`

### Requirement: Seed scripts path update
The `backend/scripts/seed-other-apps.js` SHALL reference app source files from the new `apps/` directory structure.

#### Scenario: SIBLINGS path constant
- **WHEN** `seed-other-apps.js` resolves sibling app paths
- **THEN** it SHALL resolve to the `apps/` directory under the monorepo root
- **THEN** the locker app path SHALL resolve to `apps/locker/src/App.jsx`
- **THEN** the vending app path SHALL resolve to `apps/vending/src/App.jsx`

### Requirement: Functional parity
All application behavior SHALL remain identical to the original multi-directory layout. No logic, components, API routes, or database schema changes.

#### Scenario: API routes unchanged
- **WHEN** the backend starts
- **THEN** all API endpoints SHALL respond identically to the original backend

#### Scenario: Frontend apps unchanged
- **WHEN** any frontend app is built and served
- **THEN** it SHALL render identically to the original app
