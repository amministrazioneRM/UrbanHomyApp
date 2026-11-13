-- Migration: vending_magazzino
-- Gestione carico/scarico materiale vending machine

CREATE TABLE [vending_magazzini] (
    [id]     NVARCHAR(1000) NOT NULL,
    [nome]   NVARCHAR(1000) NOT NULL,
    [sedeId] NVARCHAR(1000) NOT NULL,
    [note]   NVARCHAR(1000),
    [attivo] BIT NOT NULL CONSTRAINT [vending_magazzini_attivo_df] DEFAULT 1,
    CONSTRAINT [vending_magazzini_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [vending_prodotti] (
    [id]        NVARCHAR(1000) NOT NULL,
    [barcode]   NVARCHAR(1000) NOT NULL,
    [nome]      NVARCHAR(1000) NOT NULL,
    [unita]     NVARCHAR(1000) NOT NULL CONSTRAINT [vending_prodotti_unita_df] DEFAULT 'pz',
    [note]      NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [vending_prodotti_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [vending_prodotti_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [vending_prodotti_barcode_key] ON [vending_prodotti]([barcode]);

CREATE TABLE [vending_fornitori] (
    [id]              NVARCHAR(1000) NOT NULL,
    [codiceBC]        NVARCHAR(1000) NOT NULL,
    [ragioneSociale]  NVARCHAR(1000) NOT NULL,
    [abilitatoCarico] BIT NOT NULL CONSTRAINT [vending_fornitori_abilitatoCarico_df] DEFAULT 0,
    [dataImport]      DATETIME2 NOT NULL,
    CONSTRAINT [vending_fornitori_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [vending_fornitori_codiceBC_key] ON [vending_fornitori]([codiceBC]);

CREATE TABLE [vending_movimenti] (
    [id]                     NVARCHAR(1000) NOT NULL,
    [tipo]                   NVARCHAR(1000) NOT NULL,
    [magazzinoId]            NVARCHAR(1000) NOT NULL,
    [data]                   DATETIME2 NOT NULL,
    [ddtNumero]              NVARCHAR(1000),
    [ddtData]                DATETIME2,
    [fornitoreId]            NVARCHAR(1000),
    [macchinaDestinazioneId] NVARCHAR(1000),
    [note]                   NVARCHAR(1000),
    [operatoreNome]          NVARCHAR(1000),
    [createdAt]              DATETIME2 NOT NULL CONSTRAINT [vending_movimenti_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [vending_movimenti_pkey] PRIMARY KEY ([id])
);

CREATE INDEX [vending_movimenti_magazzinoId_idx] ON [vending_movimenti]([magazzinoId]);

CREATE TABLE [vending_movimenti_righe] (
    [id]                 NVARCHAR(1000) NOT NULL,
    [movimentoId]        NVARCHAR(1000) NOT NULL,
    [prodottoId]         NVARCHAR(1000) NOT NULL,
    [quantita]           INT NOT NULL,
    [quantitaPrecedente] INT,
    CONSTRAINT [vending_movimenti_righe_pkey] PRIMARY KEY ([id])
);

CREATE INDEX [vending_movimenti_righe_movimentoId_idx] ON [vending_movimenti_righe]([movimentoId]);

CREATE TABLE [vending_stock] (
    [magazzinoId] NVARCHAR(1000) NOT NULL,
    [prodottoId]  NVARCHAR(1000) NOT NULL,
    [quantita]    INT NOT NULL CONSTRAINT [vending_stock_quantita_df] DEFAULT 0,
    CONSTRAINT [vending_stock_pkey] PRIMARY KEY ([magazzinoId], [prodottoId])
);

-- Foreign keys
ALTER TABLE [vending_movimenti] ADD CONSTRAINT [vending_movimenti_magazzinoId_fkey]
    FOREIGN KEY ([magazzinoId]) REFERENCES [vending_magazzini]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [vending_movimenti] ADD CONSTRAINT [vending_movimenti_fornitoreId_fkey]
    FOREIGN KEY ([fornitoreId]) REFERENCES [vending_fornitori]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [vending_movimenti] ADD CONSTRAINT [vending_movimenti_macchinaDestinazioneId_fkey]
    FOREIGN KEY ([macchinaDestinazioneId]) REFERENCES [vending_macchine]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [vending_movimenti_righe] ADD CONSTRAINT [vending_movimenti_righe_movimentoId_fkey]
    FOREIGN KEY ([movimentoId]) REFERENCES [vending_movimenti]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [vending_movimenti_righe] ADD CONSTRAINT [vending_movimenti_righe_prodottoId_fkey]
    FOREIGN KEY ([prodottoId]) REFERENCES [vending_prodotti]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [vending_stock] ADD CONSTRAINT [vending_stock_magazzinoId_fkey]
    FOREIGN KEY ([magazzinoId]) REFERENCES [vending_magazzini]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [vending_stock] ADD CONSTRAINT [vending_stock_prodottoId_fkey]
    FOREIGN KEY ([prodottoId]) REFERENCES [vending_prodotti]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
