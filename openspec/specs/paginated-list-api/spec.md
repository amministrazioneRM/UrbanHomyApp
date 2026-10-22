### Requirement: GET lista con paginazione opzionale
Il sistema SHALL supportare i query params opzionali `page` (intero ≥ 1) e `pageSize` (intero, valori ammessi: 20, 50, 100) sulla GET `/` delle route manutenzioni, ticket, vendite vending e ordini locker. Quando entrambi i parametri sono presenti e validi, la risposta MUST essere un oggetto `{ items: T[], total: number, page: number, pageSize: number }` invece dell'array flat. Quando i parametri sono assenti la risposta MUST rimanere l'array flat esistente (retrocompatibilità).

#### Scenario: Richiesta paginata valida
- **WHEN** il client chiama `GET /api/manutenzioni?page=1&pageSize=20`
- **THEN** il server risponde con HTTP 200 e `{ items: [...], total: <count totale>, page: 1, pageSize: 20 }` dove `items` contiene al massimo 20 elementi

#### Scenario: Seconda pagina
- **WHEN** il client chiama `GET /api/manutenzioni?page=2&pageSize=20`
- **THEN** il server risponde con i record dalla posizione 21 alla 40 (o meno se il totale è inferiore), con `page: 2` e `total` invariato

#### Scenario: Richiesta senza parametri di paginazione
- **WHEN** il client chiama `GET /api/manutenzioni` senza query params
- **THEN** il server risponde con un array flat di tutti i record (comportamento invariato)

#### Scenario: pageSize non ammesso
- **WHEN** il client invia `pageSize=999` (valore non tra 20, 50, 100)
- **THEN** il server risponde con HTTP 400

#### Scenario: page fuori range
- **WHEN** il client invia `page=0` o un valore non intero
- **THEN** il server risponde con HTTP 400

### Requirement: Supporto paginazione su tutte e 4 le route
Il sistema SHALL applicare la paginazione opzionale alle route: `GET /api/manutenzioni`, `GET /api/ticket/tickets`, `GET /api/vending/vendite`, `GET /api/locker/ordini`. Le altre route del factory `makeCrudRouter` NON devono essere modificate.

#### Scenario: Paginazione disponibile su tutte le route target
- **WHEN** viene chiamata una qualsiasi delle 4 route con `page=1&pageSize=20`
- **THEN** la risposta è in formato envelope con `items`, `total`, `page`, `pageSize`

#### Scenario: Route non target non paginata
- **WHEN** viene chiamata una route non target (es. `GET /api/utenti/accounts`) con `page=1&pageSize=20`
- **THEN** la risposta è l'array flat invariato (i query params vengono ignorati)

### Requirement: `total` riflette il count reale dei record
Il campo `total` nella risposta paginata MUST corrispondere al numero totale di record nel database per quella risorsa (applicando eventuale filtro di scope, es. `vendingStrutturaId`), indipendentemente da `page` e `pageSize`.

#### Scenario: Total coerente con il dataset
- **WHEN** esistono 85 manutenzioni e il client chiede `page=1&pageSize=20`
- **THEN** la risposta contiene `total: 85` e `items` con 20 elementi

#### Scenario: Ultima pagina parziale
- **WHEN** esistono 85 manutenzioni e il client chiede `page=5&pageSize=20`
- **THEN** la risposta contiene `total: 85` e `items` con 5 elementi
