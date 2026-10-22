## Context

Il backend usa un factory generico `makeCrudRouter(prismaDelegate, options)` in `backend/src/routes/crud.ts` che genera le 5 route standard. La GET `/` chiama `delegate.findMany()` senza `skip`/`take` e restituisce un array flat. Il `PrismaDelegate` è tipizzato con una firma minimale che non include `count()` — va estesa.

Il frontend usa `useSyncedResource(resource, seed)` per le liste: carica tutto al primo render e sincronizza le differenze al salvataggio. Questo hook non è adatto alla paginazione (ricarica tutto ad ogni cambio). Le 4 liste da paginare (manutenzioni, ticket, vendite, ordini) sostituiranno `useSyncedResource` con uno stato di paginazione locale + fetch esplicite.

## Goals / Non-Goals

**Goals:**
- Aggiungere `page` e `pageSize` come query params opzionali alla GET `/` del factory `makeCrudRouter`; se presenti, la risposta è `{ items, total, page, pageSize }` invece dell'array flat.
- Implementare la paginazione nelle 4 app (Manutenzioni, Ticket IT, Vending, Locker) con default 20, opzioni 20/50/100.
- Ogni cambio di `page` o `pageSize` scatena una nuova chiamata API con i parametri aggiornati.
- UI con controlli pagina precedente/successiva, indicatore pagina corrente/totale pagine, e selettore dimensione pagina.

**Non-Goals:**
- Paginare altre risorse (strutture, manutentori, zone, ecc.) — rimangono con caricamento completo.
- Aggiungere cursor-based pagination o infinite scroll.
- Modificare il comportamento della GET `/` quando `page`/`pageSize` non sono presenti (retrocompatibilità garantita).
- Paginazione lato client per le risorse già caricate.

## Decisions

### D1: Risposta condizionale — array vs envelope

Quando `page` e `pageSize` sono assenti, la GET restituisce l'array flat esistente (retrocompatibile). Quando sono presenti, restituisce `{ items: T[], total: number, page: number, pageSize: number }`.

**Alternativa scartata**: risposta sempre envelope. Richiederebbe aggiornare tutti i consumer esistenti (`useSyncedResource`, app Utenti, ecc.) — troppo impatto per questa iterazione.

### D2: Estendere `PrismaDelegate` per includere `count()`

`makeCrudRouter` riceve un `PrismaDelegate` tipizzato manualmente. Per la paginazione serve `count({ where? })` per restituire il `total`. Si aggiunge `count` alla firma dell'interfaccia `PrismaDelegate` come metodo opzionale.

**Alternativa scartata**: calcolare il total con `findMany()` senza `skip`/`take` e poi contare — doppia query non necessaria quando Prisma espone `count()` nativamente.

### D3: Funzione `listPaged` separata negli `api.ts` frontend

Si aggiunge `listPaged(page: number, pageSize: number): Promise<PagedResponse<T>>` alla `Resource` delle 4 app interessate, senza modificare `list()`. `useSyncedResource` continua a usare `list()` per le altre risorse.

**Alternativa scartata**: modificare `list()` per accettare params opzionali. Cambierebbe il tipo di ritorno condizionalmente e romperebbe `useSyncedResource`.

### D4: Stato di paginazione locale nel componente App

I 4 componenti App gestiscono `page` (number, 1-indexed) e `pageSize` (number) come `useState`. Un `useEffect` con dipendenze `[page, pageSize]` chiama `listPaged` e aggiorna `items` e `total`. Cambio di `pageSize` resetta `page` a 1.

**Alternativa scartata**: hook custom `usePaginatedResource`. Aggiunge astrazione non necessaria per 4 use case identici; un `useEffect` diretto è più leggibile e manutenibile.

### D5: Componente UI paginazione

Si usa un componente inline (o funzione helper) condiviso nello stesso `App.tsx` — nessuna dipendenza esterna. Mostra: `[<] Pagina X di Y [>]` + selettore `Righe: [20 | 50 | 100]`. Disabilita `[<]` a pagina 1 e `[>]` all'ultima pagina.

## Risks / Trade-offs

- **[Risk] Filtri esistenti e paginazione** — Le app hanno filtri client-side (per struttura, stato, periodo, ecc.) applicati in-memory sull'array caricato. Con la paginazione server-side, i filtri che non vengono passati al backend mostreranno risultati parziali (solo la pagina corrente filtrata). → Mitigation: I filtri client-side rimangono applicati sui dati della pagina corrente. In una iterazione futura i filtri potranno essere spostati server-side. L'utente vedrà il numero corretto di righe per pagina ma il `total` riflette il count non filtrato — accettabile per questa iterazione.
- **[Risk] `useSyncedResource` per le manutenzioni gestisce anche la sincronizzazione delle modifiche** — Sostituendo con fetch dirette per le manutenzioni, le modifiche (create/update/delete) continuano ad usare le route PUT/POST/DELETE esistenti; solo il caricamento iniziale cambia. → Mitigation: Le funzioni di modifica non cambiano, solo il caricamento lista.
- **[Risk] Reset pagina su filtro** — Quando l'utente cambia filtro, la pagina corrente potrebbe essere invalida. → Mitigation: ogni cambio di filtro resetta `page` a 1.

## Migration Plan

1. Estendere `PrismaDelegate` e la GET `/` in `crud.ts` (backend).
2. Aggiungere `listPaged` negli `api.ts` delle 4 app.
3. Migrare i componenti App uno alla volta (Manutenzioni → Ticket IT → Vending → Locker).
4. Nessun cambio al DB né migration Prisma necessari.

## Open Questions

- I filtri esistenti (es. filtro per struttura in Vending/Locker) devono essere passati al backend come query params aggiuntivi per ottenere un `total` filtrato corretto? Per questa iterazione: no — il total è sempre il count globale non filtrato.
