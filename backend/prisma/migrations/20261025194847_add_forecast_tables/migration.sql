/*
  Warnings:

  - You are about to alter the column `password` on the `utenti_accounts` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(Max)` to `NVarChar(1000)`.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[utenti_accounts] ALTER COLUMN [password] NVARCHAR(1000) NULL;

-- CreateTable
CREATE TABLE [dbo].[forecast_bu] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [codiceBC] NVARCHAR(1000),
    [sedeCentraleId] NVARCHAR(1000) NOT NULL,
    [mewsPropertyId] NVARCHAR(1000),
    [mewsClientToken] NVARCHAR(max),
    [mewsAccessToken] NVARCHAR(max),
    [attiva] BIT NOT NULL CONSTRAINT [forecast_bu_attiva_df] DEFAULT 1,
    CONSTRAINT [forecast_bu_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[forecast_voci] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [ordine] INT NOT NULL CONSTRAINT [forecast_voci_ordine_df] DEFAULT 0,
    [attiva] BIT NOT NULL CONSTRAINT [forecast_voci_attiva_df] DEFAULT 1,
    CONSTRAINT [forecast_voci_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[forecast_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [buId] NVARCHAR(1000) NOT NULL,
    [anno] INT NOT NULL,
    [mese] INT NOT NULL,
    [voceId] NVARCHAR(1000) NOT NULL,
    [importo] DECIMAL(14,2) NOT NULL,
    [stato] NVARCHAR(1000) NOT NULL CONSTRAINT [forecast_entries_stato_df] DEFAULT 'bozza',
    [dataModifica] DATETIME2 NOT NULL,
    [utenteId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [forecast_entries_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_entries_buId_anno_mese_voceId_key] UNIQUE NONCLUSTERED ([buId],[anno],[mese],[voceId])
);

-- CreateTable
CREATE TABLE [dbo].[forecast_targets] (
    [id] NVARCHAR(1000) NOT NULL,
    [buId] NVARCHAR(1000) NOT NULL,
    [anno] INT NOT NULL,
    [mese] INT NOT NULL,
    [voceId] NVARCHAR(1000) NOT NULL,
    [importo] DECIMAL(14,2) NOT NULL,
    CONSTRAINT [forecast_targets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_targets_buId_anno_mese_voceId_key] UNIQUE NONCLUSTERED ([buId],[anno],[mese],[voceId])
);

-- CreateTable
CREATE TABLE [dbo].[forecast_storici] (
    [id] NVARCHAR(1000) NOT NULL,
    [buId] NVARCHAR(1000) NOT NULL,
    [anno] INT NOT NULL,
    [mese] INT NOT NULL,
    [voceId] NVARCHAR(1000) NOT NULL,
    [importo] DECIMAL(14,2) NOT NULL,
    [dataRegistrazione] DATETIME2 NOT NULL,
    [utenteId] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [forecast_storici_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[forecast_actuals] (
    [id] NVARCHAR(1000) NOT NULL,
    [buId] NVARCHAR(1000) NOT NULL,
    [anno] INT NOT NULL,
    [mese] INT NOT NULL,
    [voceId] NVARCHAR(1000) NOT NULL,
    [importo] DECIMAL(14,2) NOT NULL,
    [dataAggiornamento] DATETIME2 NOT NULL,
    CONSTRAINT [forecast_actuals_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_actuals_buId_anno_mese_voceId_key] UNIQUE NONCLUSTERED ([buId],[anno],[mese],[voceId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [forecast_bu_sedeCentraleId_idx] ON [dbo].[forecast_bu]([sedeCentraleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [forecast_entries_buId_anno_mese_idx] ON [dbo].[forecast_entries]([buId], [anno], [mese]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [forecast_targets_buId_anno_idx] ON [dbo].[forecast_targets]([buId], [anno]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [forecast_storici_buId_anno_mese_idx] ON [dbo].[forecast_storici]([buId], [anno], [mese]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [forecast_actuals_buId_anno_mese_idx] ON [dbo].[forecast_actuals]([buId], [anno], [mese]);

-- AddForeignKey
ALTER TABLE [dbo].[forecast_entries] ADD CONSTRAINT [forecast_entries_buId_fkey] FOREIGN KEY ([buId]) REFERENCES [dbo].[forecast_bu]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_entries] ADD CONSTRAINT [forecast_entries_voceId_fkey] FOREIGN KEY ([voceId]) REFERENCES [dbo].[forecast_voci]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_targets] ADD CONSTRAINT [forecast_targets_buId_fkey] FOREIGN KEY ([buId]) REFERENCES [dbo].[forecast_bu]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_targets] ADD CONSTRAINT [forecast_targets_voceId_fkey] FOREIGN KEY ([voceId]) REFERENCES [dbo].[forecast_voci]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_storici] ADD CONSTRAINT [forecast_storici_buId_fkey] FOREIGN KEY ([buId]) REFERENCES [dbo].[forecast_bu]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_storici] ADD CONSTRAINT [forecast_storici_voceId_fkey] FOREIGN KEY ([voceId]) REFERENCES [dbo].[forecast_voci]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_actuals] ADD CONSTRAINT [forecast_actuals_buId_fkey] FOREIGN KEY ([buId]) REFERENCES [dbo].[forecast_bu]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_actuals] ADD CONSTRAINT [forecast_actuals_voceId_fkey] FOREIGN KEY ([voceId]) REFERENCES [dbo].[forecast_voci]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
