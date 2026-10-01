## ADDED Requirements

### Requirement: Manifest per il servizio backend
Il sistema SHALL avere un manifest Kubernetes per il `backend` che definisce Deployment e Service, con riferimento all'immagine su ghcr.io e configurazione tramite Secret/ConfigMap.

#### Scenario: Deployment backend creato correttamente
- **WHEN** viene eseguito `kubectl apply -f k8s/backend.yaml`
- **THEN** il Deployment `backend` viene creato con 1 replica, le variabili d'ambiente lette da Secret e il Service esposto internamente al cluster

#### Scenario: Aggiornamento immagine backend
- **WHEN** viene eseguito `kubectl set image deployment/backend backend=ghcr.io/.../backend:<versione>`
- **THEN** k3s avvia un rolling update sostituendo i pod con la nuova immagine

---

### Requirement: Manifest per il servizio portal
Il sistema SHALL avere un manifest Kubernetes per il `portal` che definisce Deployment e Service, con riferimento all'immagine su ghcr.io.

#### Scenario: Deployment portal creato correttamente
- **WHEN** viene eseguito `kubectl apply -f k8s/portal.yaml`
- **THEN** il Deployment `portal` viene creato con 1 replica e il Service esposto sulla porta configurata

#### Scenario: Aggiornamento immagine portal
- **WHEN** viene eseguito `kubectl set image deployment/portal portal=ghcr.io/.../portal:<versione>`
- **THEN** k3s avvia un rolling update del portal

---

### Requirement: Manifest per il database Postgres
Il sistema SHALL avere un manifest Kubernetes per il database Postgres che include Deployment, Service e PersistentVolumeClaim per la persistenza dei dati.

#### Scenario: PVC creato e montato correttamente
- **WHEN** viene eseguito `kubectl apply -f k8s/db.yaml`
- **THEN** il PersistentVolumeClaim viene creato e il pod Postgres monta il volume su `/var/lib/postgresql/data`

#### Scenario: Dati persistono al riavvio del pod
- **WHEN** il pod Postgres viene riavviato o ricreato
- **THEN** i dati nel PVC sono preservati e il database si avvia con i dati esistenti

---

### Requirement: Secret Kubernetes per le variabili sensibili
Il sistema SHALL avere un manifest (o guida) per la creazione dei Secret Kubernetes che contengono variabili d'ambiente sensibili (password DB, JWT secret, ecc.).

#### Scenario: Secret applicato prima del deploy
- **WHEN** i Secret Kubernetes sono presenti nel cluster prima dell'apply dei Deployment
- **THEN** i pod si avviano correttamente leggendo le variabili d'ambiente dai Secret

#### Scenario: Secret mancante blocca l'avvio del pod
- **WHEN** un Deployment referenzia un Secret inesistente
- **THEN** il pod rimane in stato `Pending` o `CrashLoopBackOff` con errore esplicito nei log

---

### Requirement: imagePullSecret per ghcr.io
Il sistema SHALL avere un `imagePullSecret` configurato nel cluster che permette a k3s di pullare immagini private da `ghcr.io`.

#### Scenario: Pull immagine privata riuscito
- **WHEN** il Deployment referenzia un `imagePullSecret` valido con credenziali ghcr.io
- **THEN** k3s riesce a pullare l'immagine da `ghcr.io` senza errori di autenticazione

#### Scenario: imagePullSecret mancante
- **WHEN** il Deployment non ha `imagePullSecrets` configurato e l'immagine è privata
- **THEN** il pod fallisce con `ErrImagePull` o `ImagePullBackOff`

---

### Requirement: Guida passo-passo per la creazione dei manifest K8s
Il sistema SHALL fornire una guida chiara e completa per creare manualmente i manifest Kubernetes per tutti i servizi del progetto, incluse istruzioni per Secret, PVC e imagePullSecret.

#### Scenario: Sviluppatore segue la guida
- **WHEN** uno sviluppatore segue le istruzioni nei task
- **THEN** riesce a creare tutti i manifest necessari e ad applicarli sul cluster senza conoscenza pregressa di Kubernetes
