## Why

The Urban Homy administrative portal is currently split across 7 separate top-level directories (`urban-homy-home`, `urban-homy-progetto`, `urban-homy-locker`, `urban-homy-ticket-it`, `urban-homy-utenti`, `urban-homy-vending`, `urban-homy-shared`) with no unified project structure, no shared dependency management, and hardcoded Windows paths in the static server. This makes local setup error-prone (7 separate `npm install` runs, manual path fixes), prevents containerized deployment, and makes the codebase harder to navigate. Consolidating into a single well-structured directory with Docker support will dramatically simplify onboarding, deployment, and maintenance.

## What Changes

- Create a new `urban-homy-amministrazionerm/` directory at the project root containing the entire application as a unified monorepo
- Reorganize the folder structure: `apps/` for each frontend sub-application, `backend/` for the Express API, `shared/` for the common auth library, `portal/` for the home/login page
- Each sub-app retains its own `package.json`, `src/`, and `dist/` — preserving full decoupling
- The static file server (`serve.js`) uses relative paths derived from the new structure (no hardcoded paths)
- Add a `docker-compose.yml` at the root to spin up PostgreSQL + backend + static portal in one command
- Add a `Dockerfile` for the backend and a `Dockerfile` for the static portal/frontend serving
- Add a comprehensive `README.md` in English documenting the full project, stack, features, and Docker-based startup
- **No environment variable changes** — existing inline values are preserved as-is

## Capabilities

### New Capabilities
- `unified-folder-structure`: Reorganized monorepo layout under a single root with `apps/`, `backend/`, `shared/`, `portal/` directories
- `docker-deployment`: Docker Compose configuration with PostgreSQL, backend API, and static frontend services for one-command local startup
- `english-readme`: Comprehensive English README covering project overview, tech stack, features, folder structure, and Docker startup instructions

### Modified Capabilities

_(none — no existing specs)_

## Impact

- **Code**: All source files are copied 1:1 into the new structure; no logic changes. Only `serve.js` path references are updated to match the new layout.
- **Dependencies**: Each sub-app keeps its own `package.json`. No dependency merging.
- **APIs**: Backend API remains identical (Express on port 4000, same routes, same Prisma schema).
- **Systems**: New Docker infrastructure added (Compose, Dockerfiles). Existing non-Docker workflow still works.
- **Database**: Same PostgreSQL schema and seed data. Docker Compose provisions a Postgres container automatically.
