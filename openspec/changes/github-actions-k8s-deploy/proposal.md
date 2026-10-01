## Why

Il progetto non dispone di un processo di deploy automatizzato: ogni rilascio richiede intervento manuale sul server. Introdurre una pipeline CI/CD su GitHub Actions che si attiva al push su branch `release/X.X.X` elimina questo rischio operativo e standardizza il processo di rilascio, restando entro il piano free di GitHub.

## What Changes

- Aggiunta pipeline GitHub Actions attivata su push di branch `release/X.X.X`
- Build delle immagini Docker per `backend` e `portal` con tag derivato dalla versione del branch
- Push delle immagini su GitHub Container Registry (ghcr.io)
- Connessione sicura al cluster k3s tramite Tailscale (VPN) dentro il workflow
- Apply dei manifest Kubernetes sul cluster per aggiornare i Deployment con le nuove immagini
- Aggiunta manifest Kubernetes di base per `backend`, `portal`, `db` (Postgres) e relativo `postgres-exporter`, `prometheus`, `grafana`

## Capabilities

### New Capabilities

- `ci-cd-pipeline`: Workflow GitHub Actions completo per build, push su ghcr.io e deploy su k3s via Tailscale, attivato su `release/X.X.X`
- `kubernetes-manifests`: Manifest Kubernetes (Deployment, Service, ConfigMap, Secret, PersistentVolumeClaim) per tutti i servizi dell'applicativo

### Modified Capabilities

<!-- Nessuna capability esistente con requisiti modificati -->

## Impact

- Aggiunta directory `.github/workflows/` con il workflow di deploy
- Aggiunta directory `k8s/` con i manifest Kubernetes
- Richiede configurazione di GitHub Secrets nel repository: `TAILSCALE_AUTHKEY`, `KUBECONFIG`, `GHCR_TOKEN` (o uso di `GITHUB_TOKEN` nativo)
- Le immagini Docker devono essere pubbliche o il cluster deve avere accesso a ghcr.io con credenziali
- Il server deve avere Tailscale installato e il nodo registrato nell'account Tailscale
