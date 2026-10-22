### Requirement: Stato di paginazione locale nelle app
Le app Manutenzioni, Ticket IT, Vending e Locker SHALL gestire lo stato di paginazione (`page`, `pageSize`, `total`) localmente nel componente App tramite `useState`. Il valore di default di `pageSize` MUST essere 20. Ogni cambio di `page` o `pageSize` MUST scatenare una nuova chiamata API con i parametri aggiornati. Un cambio di `pageSize` MUST resettare `page` a 1.

#### Scenario: Caricamento iniziale
- **WHEN** l'utente apre la sezione lista (manutenzioni / ticket / vendite / ordini)
- **THEN** l'app chiama l'API con `page=1&pageSize=20` e mostra i primi 20 elementi

#### Scenario: Cambio pagina
- **WHEN** l'utente clicca sul controllo "pagina successiva"
- **THEN** l'app incrementa `page` di 1, chiama l'API con il nuovo `page` e mostra i nuovi elementi

#### Scenario: Cambio dimensione pagina
- **WHEN** l'utente seleziona `50` nel selettore dimensione pagina
- **THEN** l'app imposta `pageSize=50` e `page=1`, chiama l'API con i nuovi parametri e mostra i risultati dalla prima pagina

### Requirement: Controlli di navigazione paginazione
Ogni lista paginata SHALL mostrare un componente di navigazione con: pulsante pagina precedente `[<]`, indicatore `Pagina X di Y`, pulsante pagina successiva `[>]`, e selettore dimensione pagina con opzioni 20, 50, 100. Il pulsante `[<]` MUST essere disabilitato quando `page === 1`. Il pulsante `[>]` MUST essere disabilitato quando `page >= Math.ceil(total / pageSize)`.

#### Scenario: Prima pagina
- **WHEN** l'utente è alla prima pagina
- **THEN** il pulsante `[<]` è disabilitato; il pulsante `[>]` è abilitato se esistono più pagine

#### Scenario: Ultima pagina
- **WHEN** l'utente è all'ultima pagina (`page === Math.ceil(total / pageSize)`)
- **THEN** il pulsante `[>]` è disabilitato; il pulsante `[<]` è abilitato se `page > 1`

#### Scenario: Dataset vuoto
- **WHEN** la lista non contiene record (`total === 0`)
- **THEN** entrambi i pulsanti sono disabilitati e l'indicatore mostra "Pagina 0 di 0" o equivalente

#### Scenario: Dataset su una sola pagina
- **WHEN** `total <= pageSize`
- **THEN** entrambi i pulsanti sono disabilitati e l'indicatore mostra "Pagina 1 di 1"

### Requirement: Opzioni dimensione pagina
Il selettore dimensione pagina MUST offrire esattamente tre opzioni: 20, 50, 100. Il valore selezionato corrente MUST essere visivamente evidenziato o selezionato nel controllo.

#### Scenario: Selezione dimensione pagina
- **WHEN** l'utente apre il selettore dimensione pagina
- **THEN** sono visibili le opzioni 20, 50 e 100; l'opzione corrente risulta selezionata

#### Scenario: Cambio a 100
- **WHEN** l'utente seleziona 100
- **THEN** l'app chiama `GET ...?page=1&pageSize=100` e mostra fino a 100 elementi

### Requirement: Reset pagina al cambio filtro
Nelle app che hanno filtri sulla lista paginata, ogni cambio di filtro attivo SHALL resettare `page` a 1 prima di richiamare l'API.

#### Scenario: Filtro applicato con pagina > 1
- **WHEN** l'utente è alla pagina 3 e applica un filtro (es. cambia struttura o periodo)
- **THEN** `page` viene reimpostato a 1 e viene chiamata l'API con `page=1` e il filtro aggiornato
