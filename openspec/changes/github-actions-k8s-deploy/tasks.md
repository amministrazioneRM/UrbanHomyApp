## 1. Prerequisiti server e cluster

- [ ] 1.1 Installare Tailscale sul server k3s (`curl -fsSL https://tailscale.com/install.sh | sh`) e fare `tailscale up` per registrare il nodo
- [ ] 1.2 Annotare l'IP Tailscale del server (es. `100.x.x.x`) — sarà usato nel kubeconfig
- [ ] 1.3 Esportare il kubeconfig di k3s: `sudo cat /etc/rancher/k3s/k3s.yaml`, sostituire `server: https://127.0.0.1:6443` con `server: https://100.x.x.x:6443` (IP Tailscale)
- [ ] 1.4 Codificare il kubeconfig in base64: `base64 -w 0 kubeconfig.yaml` e salvare il risultato
- [ ] 1.5 Creare una Tailscale OAuth Client su https://login.tailscale.com/admin/settings/oauth con scope `devices:write` e salvare il client secret

## 2. Configurazione GitHub Secrets

- [ ] 2.1 Aggiungere secret `TAILSCALE_OAUTH_CLIENT_SECRET` nel repository GitHub (Settings → Secrets → Actions)
- [ ] 2.2 Aggiungere secret `KUBECONFIG_B64` con il contenuto base64 del kubeconfig modificato (step 1.4)
- [ ] 2.3 Verificare che il repository abbia i permessi per GitHub Container Registry (Settings → Packages → visibilità)

## 3. Manifest Kubernetes — Namespace e Secret

- [x] 3.1 Creare il file `k8s/secrets.yaml` con le istruzioni per creare manualmente i Secret Kubernetes (non committare valori reali — usare `kubectl create secret generic` da CLI)
- [ ] 3.2 Creare l'`imagePullSecret` per ghcr.io sul cluster:
  ```bash
  kubectl create secret docker-registry ghcr-secret \
    --docker-server=ghcr.io \
    --docker-username=<github-username> \
    --docker-password=<PAT-con-read:packages>
  ```
- [x] 3.3 ~~Creare `k8s/db.yaml`~~ — DB esterno al cluster, rimosso. Creato `k8s/db-external.yaml` con Endpoints + Service headless che punta all'host
- [ ] 3.4 Sostituire `<HOST_IP>` in `k8s/db-external.yaml` con l'IP host visibile dal cluster: `ip route | grep default | awk '{print $3}'`

## 4. Manifest Kubernetes — Backend e Portal

- [x] 4.1 Creare `k8s/backend.yaml` con:
  - Deployment `backend` (1 replica, immagine `ghcr.io/<org>/<repo>/backend:latest`, `imagePullSecrets: ghcr-secret`)
  - Variabili d'ambiente lette da Secret Kubernetes
  - Service ClusterIP su porta 3000
- [x] 4.2 Creare `k8s/portal.yaml` con:
  - Deployment `portal` (1 replica, immagine `ghcr.io/<org>/<repo>/portal:latest`, `imagePullSecrets: ghcr-secret`)
  - Service ClusterIP o NodePort sulla porta del portal
- [x] 4.3 Creare `k8s/monitoring.yaml` con Deployment e Service per `prometheus`, `grafana` e `postgres-exporter` (equivalente della configurazione Docker Compose già presente)
- [ ] 4.4 Applicare tutti i manifest manualmente: `kubectl apply -f k8s/`

## 5. Workflow GitHub Actions

- [x] 5.1 Creare `.github/workflows/deploy.yml` con trigger `push` su `release/**`
- [x] 5.2 Aggiungere step per estrarre la versione dal branch name: `VERSION=${GITHUB_REF#refs/heads/release/}`
- [x] 5.3 Configurare il job `build-backend` con:
- [x] 5.4 Configurare il job `build-portal` (parallelo a `build-backend`) con la stessa struttura
- [x] 5.5 Configurare il job `deploy` che dipende da `build-backend` e `build-portal` con:
- [x] 5.6 Aggiungere `permissions: packages: write, contents: read` a livello di workflow

## 6. Verifica e test della pipeline

- [ ] 6.1 Creare un branch `release/0.1.0` e fare push per triggerare la pipeline
- [ ] 6.2 Verificare che entrambi i job di build completino con successo su GitHub Actions
- [ ] 6.3 Verificare che le immagini appaiano su `ghcr.io` con il tag `0.1.0`
- [ ] 6.4 Verificare che il job `deploy` si connetta al cluster via Tailscale
- [ ] 6.5 Verificare con `kubectl get pods` che i pod siano in stato `Running` con le nuove immagini
- [ ] 6.6 Testare il rollback manuale: `kubectl set image deployment/backend backend=ghcr.io/.../backend:<versione-precedente>`

## 7. Documentazione

- [x] 7.1 Aggiornare il README con la sezione "Deploy" che descrive il processo release, i secret richiesti e le istruzioni per il primo setup del cluster
