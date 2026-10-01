## ADDED Requirements

### Requirement: English README at monorepo root
A `README.md` file SHALL exist at the monorepo root, written entirely in English.

#### Scenario: File location and language
- **WHEN** listing the monorepo root
- **THEN** `README.md` SHALL exist
- **THEN** all content SHALL be in English

### Requirement: Project overview section
The README SHALL include a project overview explaining what Urban Homy is and the purpose of the administrative portal.

#### Scenario: Overview content
- **WHEN** reading the README
- **THEN** it SHALL describe Urban Homy as a hotel group with properties in Trieste, Padova, Gorizia, and Monfalcone
- **THEN** it SHALL explain the portal is a multi-app administrative platform

### Requirement: Tech stack section
The README SHALL include a complete tech stack table covering frontend, backend, database, auth, and build tooling.

#### Scenario: Stack coverage
- **WHEN** reading the tech stack section
- **THEN** it SHALL list React 18, esbuild, Tailwind CSS, Express.js, Prisma, PostgreSQL, JWT, MSAL.js, lucide-react, and SheetJS

### Requirement: Folder structure section
The README SHALL include a visual folder structure tree showing the monorepo layout.

#### Scenario: Structure visualization
- **WHEN** reading the folder structure section
- **THEN** it SHALL show the `apps/`, `backend/`, `shared/`, `portal/` hierarchy
- **THEN** it SHALL explain what each directory contains

### Requirement: Applications and features section
The README SHALL describe each of the 6 sub-applications (portal + 5 apps) with their key features.

#### Scenario: Feature coverage
- **WHEN** reading the applications section
- **THEN** it SHALL describe the Home portal (login, SSO, launcher)
- **THEN** it SHALL describe Manutenzioni (maintenance management with all modules)
- **THEN** it SHALL describe Baggy Locker (luggage storage revenue analysis)
- **THEN** it SHALL describe Ticket IT (IT ticket management)
- **THEN** it SHALL describe Utenti e Accessi (user/role management)
- **THEN** it SHALL describe Vending Machine (vending revenue analysis)

### Requirement: Docker startup instructions
The README SHALL include clear instructions for starting the application using Docker Compose.

#### Scenario: Docker instructions
- **WHEN** reading the Docker startup section
- **THEN** it SHALL show the `docker compose up --build` command
- **THEN** it SHALL list the URLs for accessing the portal and API
- **THEN** it SHALL list default login credentials

### Requirement: Local development instructions
The README SHALL include instructions for running without Docker (manual setup).

#### Scenario: Manual setup instructions
- **WHEN** reading the local development section
- **THEN** it SHALL list prerequisites (Node.js, PostgreSQL)
- **THEN** it SHALL explain how to create the database
- **THEN** it SHALL explain how to install dependencies and run migrations
- **THEN** it SHALL explain how to build frontend apps and start the server

### Requirement: Default credentials section
The README SHALL list all seeded user accounts with their credentials and access levels.

#### Scenario: Credentials table
- **WHEN** reading the credentials section
- **THEN** it SHALL include a table with email, password, and role for each seeded account
