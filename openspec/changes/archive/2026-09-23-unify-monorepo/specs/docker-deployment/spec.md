## ADDED Requirements

### Requirement: Docker Compose file at monorepo root
A `docker-compose.yml` file SHALL exist at the monorepo root defining all services needed to run the application.

#### Scenario: File location
- **WHEN** listing the monorepo root
- **THEN** `docker-compose.yml` SHALL exist

### Requirement: PostgreSQL service
The Docker Compose file SHALL define a `db` service running PostgreSQL 14.

#### Scenario: Database service configuration
- **WHEN** `docker compose up` is executed
- **THEN** a PostgreSQL 14 container SHALL start on port 5432
- **THEN** the database name SHALL be `urbanhomy`
- **THEN** a named volume SHALL persist database data across container restarts

### Requirement: Backend API service
The Docker Compose file SHALL define a `backend` service running the Express API.

#### Scenario: Backend service configuration
- **WHEN** `docker compose up` is executed
- **THEN** the backend container SHALL expose port 4000
- **THEN** the backend SHALL depend on the `db` service
- **THEN** the backend SHALL wait for PostgreSQL to be ready before starting

#### Scenario: Backend auto-migration and seed
- **WHEN** the backend container starts
- **THEN** it SHALL run `npx prisma migrate deploy` to apply migrations
- **THEN** it SHALL run `node prisma/seed.js` to seed base data
- **THEN** it SHALL run `node scripts/seed-other-apps.js` to seed all app data
- **THEN** it SHALL run `node scripts/hash-passwords.js` to hash passwords
- **THEN** it SHALL start the Express server with `node src/index.js`

### Requirement: Portal service
The Docker Compose file SHALL define a `portal` service that builds and serves all frontend apps.

#### Scenario: Portal service configuration
- **WHEN** `docker compose up` is executed
- **THEN** the portal container SHALL expose port 5173
- **THEN** the portal SHALL depend on the `backend` service

#### Scenario: Frontend apps built during image build
- **WHEN** the portal Docker image is built
- **THEN** all 5 frontend apps SHALL be built via `npm run build` in each app directory
- **THEN** the built `dist/` artifacts SHALL be available for static serving

### Requirement: Backend Dockerfile
A `Dockerfile` SHALL exist at `backend/Dockerfile` to build the backend service image.

#### Scenario: Backend image build
- **WHEN** the backend Dockerfile is built
- **THEN** it SHALL use a Node.js 18+ base image
- **THEN** it SHALL install npm dependencies
- **THEN** it SHALL generate the Prisma client
- **THEN** it SHALL include an entrypoint script that runs migrations, seeds, and starts the server

### Requirement: Portal Dockerfile
A `Dockerfile` SHALL exist at `portal/Dockerfile` to build the portal service image.

#### Scenario: Portal image build
- **WHEN** the portal Dockerfile is built
- **THEN** it SHALL use a Node.js 18+ base image
- **THEN** it SHALL install dependencies for all 5 frontend apps
- **THEN** it SHALL build all 5 frontend apps
- **THEN** it SHALL copy the shared library and portal files
- **THEN** it SHALL run `serve.js` as the entrypoint

### Requirement: One-command startup
The entire application stack SHALL start with a single `docker compose up` command.

#### Scenario: Full stack startup
- **WHEN** a user runs `docker compose up --build` from the monorepo root
- **THEN** PostgreSQL SHALL start and become ready
- **THEN** the backend SHALL migrate, seed, and start serving on port 4000
- **THEN** the portal SHALL build frontends and start serving on port 5173
- **THEN** the login page SHALL be accessible at `http://localhost:5173`
- **THEN** the API SHALL be accessible at `http://localhost:4000`
