## Why

Attualmente il backend restituisce sempre l'intero dataset per manutenzioni, ticket, vendite vending e ordini locker: con volumi crescenti questo causa tempi di caricamento elevati, sprechi di memoria e lentezza del browser. La paginazione server-side è necessaria per rendere le liste scalabili e le risposte API prevedibili.

## What Changes

- Il backend espone i parametri `page` e `pageSize` sulla GET `/` di ciascuna delle 4 route interessate, restituendo una risposta paginata `{ items, total, page, pageSize }` invece di un array flat.
- Il factory `makeCrudRouter` in `backend/src/routes/crud.ts` viene esteso per supportare la paginazione opzionale via query params.
- Ogni `api.ts` frontend viene aggiornato con una funzione `listPaged(page, pageSize)` separata dalla `list()` esistente (che rimane per compatibilità con `useSyncedResource`).
- I componenti lista nelle 4 app (Manutenzioni, Ticket IT, Vending, Locker) smettono di usare `useSyncedResource` per i dati paginati e gestiscono lo stato di paginazione localmente con `page`, `pageSize` (default 20, opzioni 20/50/100) e `total`.
- Viene aggiunto un componente `Paginazione` (o inline) con controlli pagina precedente/successiva e selettore dimensione pagina.
- Ogni cambio di `page` o `pageSize` richiama l'API con i parametri aggiornati.

## Capabilities

### New Capabilities

- `paginated-list-api`: Il backend supporta paginazione server-side via query params `page` e `pageSize` sulle route delle liste; risponde con envelope `{ items, total, page, pageSize }`.
- `paginated-list-ui`: Il frontend delle 4 app gestisce stato di paginazione, chiama l'API pagina per pagina e mostra controlli di navigazione e selettore dimensione pagina.

### Modified Capabilities

## Impact

- **Backend**: `backend/src/routes/crud.ts` — aggiunta logica `skip`/`take` Prisma con risposta envelope. Le 4 route non richiedono modifiche specifiche se il factory è generico.
- **Frontend `apps/manutenzioni/src/api.ts`**: nuova funzione `listPaged` per le manutenzioni.
- **Frontend `apps/ticket-it/src/api.ts`**: nuova funzione `listPaged` per i ticket.
- **Frontend `apps/vending/src/api.ts`**: nuova funzione `listPaged` per le vendite.
- **Frontend `apps/locker/src/api.ts`**: nuova funzione `listPaged` per gli ordini.
- **`apps/manutenzioni/src/App.tsx`**: componente lista manutenzioni migrato a paginazione server-side.
- **`apps/ticket-it/src/App.tsx`**: componente lista ticket migrato a paginazione server-side.
- **`apps/vending/src/App.tsx`**: componente lista vendite migrato a paginazione server-side.
- **`apps/locker/src/App.tsx`**: componente lista ordini migrato a paginazione server-side.
- **Compatibilità**: `useSyncedResource` e `list()` non vengono modificati — le altre risorse (strutture, manutentori, ecc.) continuano a caricare tutto come prima.
