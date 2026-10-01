# Urban Homy Administrative Portal

A monorepo containing 6 sub-applications for hotel group management, serving the Urban Homy hotel group: **Hotello Trieste**, **Hotello Padova**, **Urban Homy Gorizia / B&B**, and **Europalace Hotel Monfalcone**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Applications & Features](#4-applications--features)
5. [Quick Start with Docker](#5-quick-start-with-docker)
6. [Local Development](#6-local-development-without-docker)
7. [Default Credentials](#7-default-credentials)
8. [API Endpoints](#8-api-endpoints)
9. [Database Schema](#9-database-schema)
10. [Deploy](#10-deploy)

---

## 1. Project Overview

The **Urban Homy Administrative Portal** is a monorepo platform built to centralize the operational management of the Urban Homy hotel group. It provides dedicated tools for maintenance tracking, IT ticketing, user & access management, luggage storage analytics, and vending machine revenue reporting — all behind a unified login portal with role-based access control.

Built with **Claude Code**.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, JSX |
| Build Tool | esbuild |
| Styling | Tailwind CSS (CDN) |
| Icons | lucide-react |
| Fonts | Fraunces, Inter, JetBrains Mono (Google Fonts) |
| Excel Import/Export | SheetJS (xlsx) — Locker & Vending apps |
| Backend | Express.js (Node.js, CommonJS) |
| ORM | Prisma 5.x |
| Database | PostgreSQL 14 |
| Authentication | JWT + bcryptjs (backend), MSAL.js for Microsoft SSO |
| Frontend Session | localStorage via shared UHAccounts library |
| Containerization | Docker + Docker Compose |

---

## 3. Folder Structure

```
urban-homy-amministrazionerm/
├── apps/
│   ├── manutenzioni/    # Maintenance management (React)
│   ├── locker/          # Baggy Locker — luggage storage (React)
│   ├── ticket-it/       # IT Ticket management (React)
│   ├── utenti/          # User & access management (React)
│   └── vending/         # Vending machine analytics (React)
├── backend/             # Express API + Prisma + PostgreSQL
│   ├── src/
│   ├── prisma/
│   ├── scripts/
│   ├── Dockerfile
│   └── entrypoint.sh
├── shared/              # Shared auth library (accounts.js)
├── portal/              # Login portal + static server
│   ├── index.html
│   ├── serve.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 4. Applications & Features

### Home Portal (`portal/`)

The entry point for the entire platform. Provides:

- **Email/password login** with JWT-based session management
- **Microsoft SSO** via MSAL.js for Azure AD-integrated accounts
- **App launcher** that dynamically surfaces only the applications each user is authorized to access
- Persistent session via `localStorage` using the shared `UHAccounts` library

---

### Manutenzioni (`apps/manutenzioni/`)

Full-featured maintenance management system for all properties.

- **Dashboard** with KPIs: open interventions, overdue items, monthly trends
- **Maintenance interventions**: create, edit, filter by property/status/technician, photo upload
- **Monthly calendar view** for scheduling and visualizing interventions
- **Inventory census**: hierarchical property structure — Properties → Zones → Rooms → Objects
- **Technician management**: internal staff and external contractors with skill profiles
- **External companies**: VAT numbers, contact details, specializations, hourly/flat rates
- **"Access as" simulation**: preview the portal as a specific technician

---

### Baggy Locker (`apps/locker/`)

Revenue analysis and reporting for the Urban Homy luggage storage service.

- **Multi-property support**: Padova (active), Trieste (upcoming)
- Revenue breakdowns by date range, property, and storage type
- **Excel import** for bulk sales data ingestion (SheetJS)
- **Excel export** for reporting and accounting handoff

---

### Ticket IT (`apps/ticket-it/`)

IT support ticket management across all properties and headquarters.

- Ticket creation with property, department, category, and priority
- Assignment and tracking through lifecycle statuses
- Photo attachments for incident documentation
- Filtering by property, assignee, status, and date range

---

### Utenti e Accessi (`apps/utenti/`)

Centralized user and access management for the entire portal.

- **User CRUD**: name, email, password, global role
- **Per-app access control**: enable/disable access to each sub-application with role assignment
- **Granular permissions per module**: read / modify / create / delete
- **Role management**: define and assign custom roles
- **Date-ranged substitutions**: temporary access delegation with automatic expiry
- **Location registry**: manage physical sites associated with users

---

### Vending Machine (`apps/vending/`)

Revenue analysis and reporting for vending machines across all properties.

- Multi-property, multi-machine support
- Sales breakdowns by date range, property, and machine
- **Excel import** for bulk sales data ingestion (SheetJS)
- **Excel export** for reporting and accounting handoff

---

## 5. Quick Start with Docker

> **Prerequisites**: Docker and Docker Compose installed.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Portal (Frontend) | http://localhost:5173 |
| API (Backend) | http://localhost:4000 |

The database is automatically provisioned, migrations are applied, and seed data is loaded on first startup via `entrypoint.sh`.

---

## 6. Local Development (without Docker)

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14

### Steps

**1. Create the database**

```bash
createdb urbanhomy
```

**2. Backend setup**

```bash
cd backend
cp .env.example .env        # Edit DATABASE_URL and JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
node scripts/seed-other-apps.js
node scripts/hash-passwords.js
npm run dev                  # API available at http://localhost:4000
```

**3. Build frontend apps**

```bash
cd apps/manutenzioni && npm install && npm run build
cd apps/locker       && npm install && npm run build
cd apps/ticket-it    && npm install && npm run build
cd apps/utenti       && npm install && npm run build
cd apps/vending      && npm install && npm run build
```

> Use `npm run watch` in any app directory for development with automatic rebuild on file changes.

**4. Start the portal**

```bash
node portal/serve.js         # Portal available at http://localhost:5173
```

---

## 7. Default Credentials

> These credentials are created by the seed scripts. Change passwords before any production deployment.

| Email | Password | Role |
|---|---|---|
| admin@urbanhomy.it | admin123 | Global Administrator |
| marco.b@urbanhomy.it | manutenzione123 | Manutenzioni Admin |
| maria.c@urbanhomy.it | reception123 | Ticket IT User |
| davide.r@urbanhomy.it | amministrazione123 | Ticket IT Admin |

---

## 8. API Endpoints

Base URL: `http://localhost:4000`

Auth routes (`/api/auth/*`) are **public**. All other routes require:

```
Authorization: Bearer <token>
```

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login with email/password |
| POST | /api/auth/sso | Login with Microsoft SSO token |
| GET | /api/auth/me | Get current authenticated user |
| CRUD | /api/strutture | Properties |
| CRUD | /api/zone | Zones |
| CRUD | /api/camere | Rooms |
| CRUD | /api/oggetti | Assets / Objects |
| CRUD | /api/manutenzioni | Maintenance events |
| CRUD | /api/manutentori | Technicians |
| CRUD | /api/ditte | External companies |
| CRUD | /api/figure-professionali | Professional roles |
| CRUD | /api/utenti/* | Users, roles, locations, substitutions |
| CRUD | /api/tickets/* | IT tickets |
| CRUD | /api/locker/* | Locker orders and sales |
| CRUD | /api/vending/* | Vending machines and sales |

> CRUD denotes that GET (list + detail), POST, PUT/PATCH, and DELETE operations are available unless otherwise restricted by role permissions.

---

## 9. Database Schema

The PostgreSQL database is managed via **Prisma** migrations. Tables are organized by functional area:

| Area | Tables |
|---|---|
| Maintenance | `strutture`, `zone`, `camere`, `oggetti`, `manutenzioni`, `tempi_registrati`, `materiali`, `storico_modifiche`, `manutentori`, `ditte`, `figure_professionali` |
| Users & Access | `utenti_accounts`, `utenti_ruoli`, `utenti_sostituti`, `utenti_sedi` |
| Ticket IT | `ticket_strutture`, `ticket_utenti`, `tickets` |
| Baggy Locker | `locker_strutture`, `locker_ordini`, `locker_locali`, `locker_vendite` |
| Vending | `vending_strutture`, `vending_macchine`, `vending_vendite` |

---

## 10. Deploy

### Processo di rilascio

Il deploy avviene automaticamente tramite GitHub Actions ogni volta che viene fatto un push su un branch con pattern `release/X.X.X`.

```bash
git checkout -b release/1.2.3
git push origin release/1.2.3
# → GitHub Actions builda le immagini e le deploya su k3s automaticamente
```

La pipeline:
1. Builda le immagini Docker di `backend` e `portal` in parallelo
2. Fa push su GitHub Container Registry (`ghcr.io`) con tag versione (es. `1.2.3`) e `latest`
3. Si connette al cluster k3s via Tailscale VPN
4. Aggiorna i Deployment Kubernetes con le nuove immagini

### GitHub Secrets richiesti

Configurare in **Settings → Secrets and Variables → Actions**:

| Secret | Descrizione |
|---|---|
| `TAILSCALE_OAUTH_CLIENT_ID` | ID del Tailscale OAuth Client |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Secret del Tailscale OAuth Client |
| `KUBECONFIG_B64` | kubeconfig di k3s codificato in base64 (con IP Tailscale del server) |

Configurare in **Settings → Secrets and Variables → Variables**:

| Variable | Descrizione |
|---|---|
| `API_BASE_URL` | URL pubblico del backend (es. `https://api.example.com/api`) — usato al build time del portal |

### Setup iniziale del cluster (una tantum)

> Vedere `k8s/secrets.yaml` per i comandi completi.

```bash
# 1. Installa Tailscale sul server e registra il nodo
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# 2. Crea i Secret Kubernetes (vedi k8s/secrets.yaml per tutti i comandi)
kubectl create secret generic urbanhomy-db-secret --from-literal=...
kubectl create secret generic urbanhomy-backend-secret --from-literal=...
kubectl create secret generic urbanhomy-grafana-secret --from-literal=...

# 3. Crea l'imagePullSecret per ghcr.io
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<PAT-con-read:packages>

# 4. Applica i manifest Kubernetes (prima volta)
kubectl apply -f k8s/
```

### Rollback manuale

```bash
kubectl set image deployment/backend backend=ghcr.io/<org>/urban-homy-amministrazionerm/backend:<versione-precedente>
kubectl set image deployment/portal portal=ghcr.io/<org>/urban-homy-amministrazionerm/portal:<versione-precedente>
```

### Porte esposte dal cluster (NodePort)

| Servizio | Porta sul server |
|---|---|
| Portal | `30173` |
| Grafana | `30300` |
| Prometheus | interno al cluster (ClusterIP) |

---

*Built with [Claude Code](https://claude.ai/code)*
