## 1. Backend — estensione `makeCrudRouter`

- [x] 1.1 Aggiungere `count(args?: { where?: AnyRecord }): Promise<number>` all'interfaccia `PrismaDelegate` in `backend/src/routes/crud.ts`
- [x] 1.2 Aggiungere `paginated?: boolean` a `CrudOptions` per abilitare la paginazione su una route specifica
- [x] 1.3 Modificare la GET `/` in `makeCrudRouter`: leggere `req.query.page` e `req.query.pageSize`; se presenti e `paginated` è true, validare i valori (page ≥ 1, pageSize ∈ {20,50,100}) e rispondere 400 se non validi
- [x] 1.4 Implementare la logica paginata nella GET `/`: usare `skip = (page - 1) * pageSize` e `take = pageSize` in `findMany`, chiamare `delegate.count({ where })` per ottenere il `total`, restituire `{ items, total, page, pageSize }`
- [x] 1.5 Verificare che senza `page`/`pageSize` la GET `/` continui a restituire l'array flat (retrocompatibilità)

## 2. Backend — abilitare paginazione sulle 4 route target

- [x] 2.1 In `backend/src/index.ts`, aggiungere `paginated: true` alle opzioni di `makeCrudRouter` per `/api/manutenzioni`
- [x] 2.2 Aggiungere `paginated: true` alle opzioni di `makeCrudRouter` per `/api/ticket/tickets`
- [x] 2.3 Aggiungere `paginated: true` alle opzioni di `makeCrudRouter` per `/api/vending/vendite`
- [x] 2.4 Aggiungere `paginated: true` alle opzioni di `makeCrudRouter` per `/api/locker/ordini`

## 3. Frontend — tipi e funzione `listPaged` condivisa

- [x] 3.1 Definire l'interfaccia `PagedResponse<T>` (`{ items: T[], total: number, page: number, pageSize: number }`) e il tipo `PageSize = 20 | 50 | 100` in `apps/manutenzioni/src/api.ts`
- [x] 3.2 Aggiungere `listPaged(page: number, pageSize: PageSize): Promise<PagedResponse<T>>` alla `Resource` di `api.manutenzioni` in `apps/manutenzioni/src/api.ts`
- [x] 3.3 Aggiungere `PagedResponse<T>` e `listPaged` a `apps/ticket-it/src/api.ts` per `api.ticket`
- [x] 3.4 Aggiungere `PagedResponse<T>` e `listPaged` a `apps/vending/src/api.ts` per `api.vendite`
- [x] 3.5 Aggiungere `PagedResponse<T>` e `listPaged` a `apps/locker/src/api.ts` per `api.ordini`

## 4. Frontend — app Manutenzioni

- [x] 4.1 In `apps/manutenzioni/src/App.tsx`, sostituire `useSyncedResource(api.manutenzioni, ...)` con `useState` per `manutenzioni`, `manutenzioniTotal`, `manutenzioniPage` (default 1), `manutenzioniPageSize` (default 20)
- [x] 4.2 Aggiungere `useEffect` con dipendenze `[manutenzioniPage, manutenzioniPageSize]` che chiama `api.manutenzioni.listPaged(page, pageSize)` e aggiorna gli stati
- [x] 4.3 Assicurarsi che ogni cambio di filtro esistente sulla lista manutenzioni resetti `manutenzioniPage` a 1 prima di richiamare l'API
- [x] 4.4 Aggiungere il componente/UI di paginazione nella sezione lista manutenzioni: pulsanti `[<]` / `[>]`, indicatore `Pagina X di Y`, selettore 20/50/100

## 5. Frontend — app Ticket IT

- [x] 5.1 In `apps/ticket-it/src/App.tsx`, sostituire `useSyncedResource(api.ticket, ...)` con `useState` per `ticket`, `ticketTotal`, `ticketPage` (default 1), `ticketPageSize` (default 20)
- [x] 5.2 Aggiungere `useEffect` con dipendenze `[ticketPage, ticketPageSize]` che chiama `api.ticket.listPaged(page, pageSize)` e aggiorna gli stati
- [x] 5.3 Assicurarsi che ogni cambio di filtro esistente sulla lista ticket resetti `ticketPage` a 1
- [x] 5.4 Aggiungere UI paginazione nella sezione lista ticket: pulsanti `[<]` / `[>]`, indicatore `Pagina X di Y`, selettore 20/50/100

## 6. Frontend — app Vending

- [x] 6.1 In `apps/vending/src/App.tsx`, sostituire `useSyncedResource(api.vendite, ...)` con `useState` per `vendite`, `venditeTotal`, `venditePage` (default 1), `venditePageSize` (default 20)
- [x] 6.2 Aggiungere `useEffect` con dipendenze `[venditePage, venditePageSize]` che chiama `api.vendite.listPaged(page, pageSize)` e aggiorna gli stati
- [x] 6.3 Assicurarsi che ogni cambio di filtro esistente sulle vendite (es. periodo, struttura) resetti `venditePage` a 1
- [x] 6.4 Aggiungere UI paginazione nella sezione lista vendite: pulsanti `[<]` / `[>]`, indicatore `Pagina X di Y`, selettore 20/50/100

## 7. Frontend — app Locker

- [x] 7.1 In `apps/locker/src/App.tsx`, sostituire `useSyncedResource(api.ordini, ...)` con `useState` per `ordini`, `ordiniTotal`, `ordiniPage` (default 1), `ordiniPageSize` (default 20)
- [x] 7.2 Aggiungere `useEffect` con dipendenze `[ordiniPage, ordiniPageSize]` che chiama `api.ordini.listPaged(page, pageSize)` e aggiorna gli stati
- [x] 7.3 Assicurarsi che ogni cambio di filtro esistente sugli ordini (es. periodo, struttura) resetti `ordiniPage` a 1
- [x] 7.4 Aggiungere UI paginazione nella sezione lista ordini: pulsanti `[<]` / `[>]`, indicatore `Pagina X di Y`, selettore 20/50/100

## 8. Verifica finale

- [x] 8.1 Testare che le 4 route backend rispondano correttamente con e senza parametri di paginazione
- [x] 8.2 Verificare che le route non target (es. `/api/utenti/accounts`) non siano influenzate
- [x] 8.3 Verificare che il cambio di `pageSize` resetti sempre `page` a 1 in tutte e 4 le app
- [x] 8.4 Verificare che pulsante `[<]` sia disabilitato a pagina 1 e `[>]` all'ultima pagina in tutte e 4 le app
