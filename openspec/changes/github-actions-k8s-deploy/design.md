## Context

Il progetto è un'applicazione composta da tre servizi (backend Node.js, portal Next.js, database Postgres) orchestrati via Docker Compose in sviluppo. L'obiettivo è automatizzare il deploy su un cluster k3s single-node self-hosted, raggiungibile da GitHub Actions tramite Tailscale VPN. Il piano free di GitHub Actions garantisce 2000 minuti/mese su runner Linux, sufficienti per pipeline di build+deploy se ottimizzate.

## Goals / Non-Goals

**Goals:**
- Pipeline attivata automaticamente su push di branch `release/X.X.X`
- Build parallela delle immagini Docker con tag versione (estratto dal nome del branch)
- Push su GitHub Container Registry (ghcr.io) usando `GITHUB_TOKEN` nativo (nessun secret aggiuntivo)
- Connessione al cluster k3s via Tailscale Ephemeral Auth Key (sicura, senza IP pubblici esposti)
- Deploy su k3s tramite `kubectl apply` con aggiornamento delle immagini via `kubectl set image`
- Manifest Kubernetes di base per tutti i servizi documentati in forma di guida

**Non-Goals:**
- Ambienti staging/preview — solo production
- Rollback automatico — gestito manualmente
- Helm chart — manifest plain YAML per semplicità
- Gestione certificati TLS/Ingress — fuori scope (da aggiungere separatamente)
- Auto-scaling — non necessario per single-node

## Decisions

### 1. Tailscale Ephemeral Auth Key per la connessione al cluster

**Scelta**: usare `tailscale/github-action@v2` con una Ephemeral Auth Key.

**Rationale**: Non espone l'API server di k3s su internet. L'Ephemeral Key crea un nodo temporaneo nella rete Tailscale per la durata del job, poi viene rimosso automaticamente. Alternativa scartata: IP pubblico con kubeconfig diretto — superficie di attacco eccessiva.

**Secret richiesto**: `TAILSCALE_OAUTH_CLIENT_SECRET` (o `TAILSCALE_AUTHKEY` se si usa una pre-auth key).

### 2. GITHUB_TOKEN nativo per ghcr.io

**Scelta**: usare `GITHUB_TOKEN` fornito da GitHub Actions per autenticarsi su `ghcr.io`.

**Rationale**: Elimina la necessità di creare e ruotare PAT. Il token ha scope `packages:write` abilitabile nel workflow con `permissions: packages: write`. Alternativa scartata: Docker Hub — introduce dipendenza da account esterno e rate limits.

### 3. Tag immagine derivato dal branch name

**Scelta**: estrarre la versione dal branch `release/X.X.X` con `${GITHUB_REF#refs/heads/release/}` → es. `1.2.3`.

**Rationale**: Le immagini vengono taggate con la versione semantica, permettendo rollback manuale a versioni precedenti sul cluster. Si aggiunge anche il tag `latest` per comodità.

### 4. kubectl set image per l'update del Deployment

**Scelta**: dopo `kubectl apply -f k8s/`, usare `kubectl set image` per forzare l'aggiornamento delle immagini con il tag preciso della versione.

**Rationale**: Evita la dipendenza da `imagePullPolicy: Always` con tag `latest` (anti-pattern). Ogni deploy è riproducibile tramite tag versione. Alternativa considerata: kustomize con patch di immagine — aggiunge complessità non giustificata per un single-node.

### 5. Struttura manifest Kubernetes in `k8s/`

**Scelta**: directory `k8s/` con un file per namespace funzionale: `backend.yaml`, `portal.yaml`, `db.yaml`, `monitoring.yaml`, `secrets.yaml`, `namespaces.yaml`.

**Rationale**: Semplice da applicare con `kubectl apply -f k8s/`, facile da mantenere. Non si usa un namespace dedicato per iniziare (tutto in `default`), per semplicità.

## Risks / Trade-offs

- **[Risk] Tailscale Auth Key scade o viene revocata** → Mitigation: usare OAuth Client (non scade) oppure monitorare la scadenza delle pre-auth key in Tailscale admin
- **[Risk] Build lenta consuma minuti Actions** → Mitigation: abilitare Docker layer caching tramite `cache-from`/`cache-to` con GitHub Actions cache
- **[Risk] Immagini ghcr.io private non accessibili dal cluster** → Mitigation: creare un `imagePullSecret` nel cluster con un PAT con scope `read:packages`, e referenziarlo nei Deployment
- **[Risk] k3s non raggiungibile via Tailscale durante il job** → Mitigation: il kubeconfig deve usare l'IP Tailscale del server (es. `100.x.x.x`), non l'IP LAN

## Migration Plan

1. Installare Tailscale sul server k3s e registrare il nodo
2. Creare una Tailscale OAuth Client (o Ephemeral Auth Key) e aggiungerla come GitHub Secret
3. Esportare il kubeconfig di k3s (`/etc/rancher/k3s/k3s.yaml`) e modificare `server:` con l'IP Tailscale del nodo — aggiungerlo come GitHub Secret `KUBECONFIG_B64` (base64-encoded)
4. Creare l'`imagePullSecret` nel cluster per ghcr.io
5. Applicare i manifest Kubernetes iniziali manualmente una volta (`kubectl apply -f k8s/`)
6. Da quel momento in poi, ogni push su `release/X.X.X` triggera il deploy automatico

**Rollback**: `kubectl set image deployment/backend backend=ghcr.io/<org>/<repo>/backend:<versione-precedente>`

## Open Questions

- Il server ha già Tailscale installato e il nodo registrato?
- Il cluster ha già un `imagePullSecret` per ghcr.io configurato?
- Esiste già un namespace dedicato nel cluster o si usa `default`?
