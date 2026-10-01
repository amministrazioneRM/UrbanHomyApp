## ADDED Requirements

### Requirement: Pipeline attivata su branch release
Il sistema SHALL attivare automaticamente la pipeline di deploy ogni volta che viene effettuato un push su un branch con pattern `release/X.X.X` (dove X è un numero intero).

#### Scenario: Push su branch release valido
- **WHEN** viene effettuato un push su un branch con nome `release/1.2.3`
- **THEN** il workflow GitHub Actions viene attivato automaticamente

#### Scenario: Push su branch non-release ignorato
- **WHEN** viene effettuato un push su `main` o qualsiasi branch non corrispondente a `release/**`
- **THEN** il workflow non viene attivato

---

### Requirement: Estrazione versione dal branch name
Il sistema SHALL estrarre la versione semantica (es. `1.2.3`) dal nome del branch `release/X.X.X` e usarla come tag delle immagini Docker.

#### Scenario: Tag immagine corretto
- **WHEN** il branch si chiama `release/2.0.1`
- **THEN** le immagini Docker vengono taggate `ghcr.io/<org>/<repo>/backend:2.0.1` e `ghcr.io/<org>/<repo>/portal:2.0.1`

---

### Requirement: Build Docker con layer caching
Il sistema SHALL buildare le immagini Docker per `backend` e `portal` usando il layer caching di GitHub Actions per minimizzare i minuti consumati.

#### Scenario: Build con cache hit
- **WHEN** il layer cache è disponibile da una run precedente
- **THEN** la build riusa i layer cachati e si completa più velocemente

#### Scenario: Build senza cache disponibile
- **WHEN** non esiste cache precedente
- **THEN** la build avviene normalmente dal primo layer

---

### Requirement: Push immagini su ghcr.io
Il sistema SHALL fare il push delle immagini buildate su GitHub Container Registry usando il `GITHUB_TOKEN` nativo senza richiedere PAT aggiuntivi.

#### Scenario: Push su ghcr.io con GITHUB_TOKEN
- **WHEN** la build è completata con successo
- **THEN** le immagini vengono pushate su `ghcr.io` con tag versione e tag `latest`

#### Scenario: Permessi insufficienti bloccano il push
- **WHEN** il workflow non ha `permissions: packages: write`
- **THEN** il push fallisce con errore 403 e il job termina in errore

---

### Requirement: Connessione al cluster via Tailscale
Il sistema SHALL connettersi al cluster k3s tramite Tailscale usando una OAuth Client Secret o Ephemeral Auth Key, senza esporre l'API server di Kubernetes su internet.

#### Scenario: Connessione Tailscale riuscita
- **WHEN** il secret `TAILSCALE_OAUTH_CLIENT_SECRET` è configurato e il nodo server è attivo nella rete Tailscale
- **THEN** il runner GitHub Actions si connette alla rete Tailscale e può raggiungere il cluster k3s tramite IP Tailscale

#### Scenario: Secret Tailscale mancante o non valido
- **WHEN** il secret `TAILSCALE_OAUTH_CLIENT_SECRET` non è configurato o è scaduto
- **THEN** il job fallisce nello step di connessione Tailscale con messaggio di errore esplicito

---

### Requirement: Deploy sul cluster k3s
Il sistema SHALL aggiornare i Deployment Kubernetes con le nuove immagini usando `kubectl set image` dopo aver applicato i manifest base.

#### Scenario: Deploy completato con successo
- **WHEN** la connessione Tailscale è attiva e il kubeconfig è configurato correttamente
- **THEN** `kubectl set image` aggiorna tutti i Deployment con il nuovo tag versione e il rollout viene completato

#### Scenario: kubeconfig non valido o scaduto
- **WHEN** il secret `KUBECONFIG_B64` contiene un kubeconfig non valido o con credenziali scadute
- **THEN** il job fallisce nello step `kubectl` con messaggio di errore esplicito

---

### Requirement: Ottimizzazione per piano free GitHub Actions
Il sistema SHALL strutturare la pipeline in modo da minimizzare i minuti Actions consumati, rimanendo entro i limiti del piano free (2000 min/mese su Linux).

#### Scenario: Step paralleli per backend e portal
- **WHEN** la pipeline viene eseguita
- **THEN** le build di `backend` e `portal` avvengono in job separati eseguiti in parallelo, riducendo il tempo totale

#### Scenario: Skip del deploy se build fallisce
- **WHEN** la build di una qualsiasi immagine fallisce
- **THEN** il job di deploy non viene eseguito, evitando minuti sprecati
