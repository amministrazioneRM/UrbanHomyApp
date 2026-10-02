BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[strutture] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [citta] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [eliminato] BIT NOT NULL CONSTRAINT [strutture_eliminato_df] DEFAULT 0,
    CONSTRAINT [strutture_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[zone] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [zone_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[camere] (
    [id] NVARCHAR(1000) NOT NULL,
    [zonaId] NVARCHAR(1000) NOT NULL,
    [numero] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [camere_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[oggetti] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [zonaId] NVARCHAR(1000),
    [camereId] NVARCHAR(1000),
    [nome] NVARCHAR(1000) NOT NULL,
    [categoria] NVARCHAR(1000) NOT NULL,
    [codiceCespite] NVARCHAR(1000) NOT NULL,
    [condizione] NVARCHAR(1000) NOT NULL,
    [ultimaVerifica] DATETIME2,
    CONSTRAINT [oggetti_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[manutenzioni] (
    [id] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [zonaId] NVARCHAR(1000),
    [camereId] NVARCHAR(1000),
    [oggettoId] NVARCHAR(1000),
    [titolo] NVARCHAR(1000) NOT NULL,
    [descrizione] NVARCHAR(1000) NOT NULL,
    [priorita] NVARCHAR(1000) NOT NULL,
    [stato] NVARCHAR(1000) NOT NULL,
    [dataCreazione] DATETIME2 NOT NULL,
    [scadenza] DATETIME2 NOT NULL,
    [dataApprovazione] DATETIME2,
    [assegnatoId] NVARCHAR(1000),
    [assegnatoLibero] NVARCHAR(1000),
    [ricorrenza] NVARCHAR(max),
    [note] NVARCHAR(1000),
    [notaChiusura] NVARCHAR(1000),
    [foto] NVARCHAR(max) NOT NULL CONSTRAINT [manutenzioni_foto_df] DEFAULT '[]',
    CONSTRAINT [manutenzioni_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[tempi_registrati] (
    [id] NVARCHAR(1000) NOT NULL,
    [manutenzioneId] NVARCHAR(1000) NOT NULL,
    [manutentoreId] NVARCHAR(1000) NOT NULL,
    [minuti] INT NOT NULL,
    [data] DATETIME2 NOT NULL,
    [note] NVARCHAR(1000),
    CONSTRAINT [tempi_registrati_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[materiali] (
    [id] NVARCHAR(1000) NOT NULL,
    [manutenzioneId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [quantita] INT NOT NULL,
    [costoUnitario] DECIMAL(10,2) NOT NULL,
    [note] NVARCHAR(1000),
    [stato] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [materiali_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[storico_modifiche] (
    [id] NVARCHAR(1000) NOT NULL,
    [manutenzioneId] NVARCHAR(1000) NOT NULL,
    [data] DATETIME2 NOT NULL,
    [utenteId] NVARCHAR(1000) NOT NULL,
    [dettagli] NVARCHAR(max) NOT NULL CONSTRAINT [storico_modifiche_dettagli_df] DEFAULT '[]',
    CONSTRAINT [storico_modifiche_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ditte] (
    [id] NVARCHAR(1000) NOT NULL,
    [ragioneSociale] NVARCHAR(1000) NOT NULL,
    [piva] NVARCHAR(1000) NOT NULL,
    [indirizzo] NVARCHAR(1000),
    [telefono] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [referente] NVARCHAR(1000),
    [specializzazioni] NVARCHAR(max) NOT NULL CONSTRAINT [ditte_specializzazioni_df] DEFAULT '[]',
    [strutture] NVARCHAR(max) NOT NULL CONSTRAINT [ditte_strutture_df] DEFAULT '[]',
    [attivo] BIT NOT NULL CONSTRAINT [ditte_attivo_df] DEFAULT 1,
    [dataFineContratto] DATETIME2,
    [approvatoreId] NVARCHAR(1000),
    [note] NVARCHAR(1000),
    [tariffe] NVARCHAR(max) NOT NULL CONSTRAINT [ditte_tariffe_df] DEFAULT '[]',
    CONSTRAINT [ditte_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[manutentori] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [dittaId] NVARCHAR(1000),
    [visibilita] NVARCHAR(1000) NOT NULL,
    [figuraProfessionaleId] NVARCHAR(1000),
    [telefono] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [strutture] NVARCHAR(max) NOT NULL CONSTRAINT [manutentori_strutture_df] DEFAULT '[]',
    [attivo] BIT NOT NULL CONSTRAINT [manutentori_attivo_df] DEFAULT 1,
    [note] NVARCHAR(1000),
    [sostitutoId] NVARCHAR(1000),
    CONSTRAINT [manutentori_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[figure_professionali] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [figure_professionali_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[utenti_accounts] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [ruoloGlobale] NVARCHAR(1000) NOT NULL,
    [accessi] NVARCHAR(max) NOT NULL,
    CONSTRAINT [utenti_accounts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[utenti_ruoli] (
    [id] NVARCHAR(1000) NOT NULL,
    [appId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [bloccato] BIT NOT NULL CONSTRAINT [utenti_ruoli_bloccato_df] DEFAULT 0,
    [permessi] NVARCHAR(max) NOT NULL,
    CONSTRAINT [utenti_ruoli_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[utenti_sostituti] (
    [id] NVARCHAR(1000) NOT NULL,
    [titolareId] NVARCHAR(1000) NOT NULL,
    [appId] NVARCHAR(1000) NOT NULL,
    [sostitutoId] NVARCHAR(1000) NOT NULL,
    [dataInizio] DATETIME2 NOT NULL,
    [dataFine] DATETIME2 NOT NULL,
    [note] NVARCHAR(1000),
    CONSTRAINT [utenti_sostituti_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[utenti_sedi] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [citta] NVARCHAR(1000),
    [indirizzo] NVARCHAR(1000),
    [attiva] BIT NOT NULL CONSTRAINT [utenti_sedi_attiva_df] DEFAULT 1,
    CONSTRAINT [utenti_sedi_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ticket_strutture] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ticket_strutture_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ticket_utenti] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [reparto] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ticket_utenti_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[tickets] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [reparto] NVARCHAR(1000) NOT NULL,
    [titolo] NVARCHAR(1000) NOT NULL,
    [descrizione] NVARCHAR(1000) NOT NULL,
    [categoria] NVARCHAR(1000) NOT NULL,
    [priorita] NVARCHAR(1000) NOT NULL,
    [stato] NVARCHAR(1000) NOT NULL,
    [dataCreazione] DATETIME2 NOT NULL,
    [scadenza] DATETIME2 NOT NULL,
    [richiedente] NVARCHAR(1000),
    [note] NVARCHAR(1000),
    [foto] NVARCHAR(max) NOT NULL CONSTRAINT [tickets_foto_df] DEFAULT '[]',
    CONSTRAINT [tickets_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[locker_strutture] (
    [id] NVARCHAR(1000) NOT NULL,
    [sedeCentraleId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [citta] NVARCHAR(1000) NOT NULL,
    [attiva] BIT NOT NULL CONSTRAINT [locker_strutture_attiva_df] DEFAULT 1,
    CONSTRAINT [locker_strutture_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[locker_ordini] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [dataOrdine] DATETIME2 NOT NULL,
    [oraOrdine] NVARCHAR(1000) NOT NULL,
    [inizio] DATETIME2 NOT NULL,
    [oraInizio] NVARCHAR(1000) NOT NULL,
    [fine] DATETIME2 NOT NULL,
    [oraFine] NVARCHAR(1000) NOT NULL,
    [prezzo] DECIMAL(10,2) NOT NULL,
    [stato] NVARCHAR(1000) NOT NULL,
    [numArmadio] INT NOT NULL,
    [tipologia] NVARCHAR(1000) NOT NULL,
    [provenienza] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [locker_ordini_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[locker_locali] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [conteggi] NVARCHAR(max) NOT NULL,
    CONSTRAINT [locker_locali_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[locker_vendite] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [data] DATETIME2 NOT NULL,
    [ora] NVARCHAR(1000) NOT NULL,
    [prodotto] NVARCHAR(1000) NOT NULL,
    [quantita] INT NOT NULL,
    [prezzoUnitario] DECIMAL(10,2) NOT NULL,
    [metodoPagamento] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [locker_vendite_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[vending_strutture] (
    [id] NVARCHAR(1000) NOT NULL,
    [sedeCentraleId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [citta] NVARCHAR(1000) NOT NULL,
    [attiva] BIT NOT NULL CONSTRAINT [vending_strutture_attiva_df] DEFAULT 1,
    CONSTRAINT [vending_strutture_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[vending_macchine] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [attiva] BIT NOT NULL CONSTRAINT [vending_macchine_attiva_df] DEFAULT 1,
    CONSTRAINT [vending_macchine_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[vending_vendite] (
    [id] NVARCHAR(1000) NOT NULL,
    [strutturaId] NVARCHAR(1000) NOT NULL,
    [macchinaId] NVARCHAR(1000),
    [macchinaNome] NVARCHAR(1000),
    [data] DATETIME2 NOT NULL,
    [ora] NVARCHAR(1000) NOT NULL,
    [prodotto] NVARCHAR(1000) NOT NULL,
    [quantita] INT NOT NULL,
    [prezzoUnitario] DECIMAL(10,2) NOT NULL,
    [metodoPagamento] NVARCHAR(1000) NOT NULL,
    [stato] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [vending_vendite_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [zone_strutturaId_idx] ON [dbo].[zone]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [camere_zonaId_idx] ON [dbo].[camere]([zonaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [oggetti_strutturaId_idx] ON [dbo].[oggetti]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [oggetti_zonaId_idx] ON [dbo].[oggetti]([zonaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [oggetti_camereId_idx] ON [dbo].[oggetti]([camereId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [manutenzioni_strutturaId_idx] ON [dbo].[manutenzioni]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [manutenzioni_stato_idx] ON [dbo].[manutenzioni]([stato]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tempi_registrati_manutenzioneId_idx] ON [dbo].[tempi_registrati]([manutenzioneId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [materiali_manutenzioneId_idx] ON [dbo].[materiali]([manutenzioneId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [storico_modifiche_manutenzioneId_idx] ON [dbo].[storico_modifiche]([manutenzioneId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [manutentori_dittaId_idx] ON [dbo].[manutentori]([dittaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ticket_utenti_strutturaId_idx] ON [dbo].[ticket_utenti]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [tickets_strutturaId_idx] ON [dbo].[tickets]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [locker_ordini_strutturaId_idx] ON [dbo].[locker_ordini]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [locker_locali_strutturaId_idx] ON [dbo].[locker_locali]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [locker_vendite_strutturaId_idx] ON [dbo].[locker_vendite]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vending_macchine_strutturaId_idx] ON [dbo].[vending_macchine]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vending_vendite_strutturaId_idx] ON [dbo].[vending_vendite]([strutturaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [vending_vendite_macchinaId_idx] ON [dbo].[vending_vendite]([macchinaId]);

-- AddForeignKey
ALTER TABLE [dbo].[zone] ADD CONSTRAINT [zone_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[camere] ADD CONSTRAINT [camere_zonaId_fkey] FOREIGN KEY ([zonaId]) REFERENCES [dbo].[zone]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[oggetti] ADD CONSTRAINT [oggetti_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[strutture]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[oggetti] ADD CONSTRAINT [oggetti_zonaId_fkey] FOREIGN KEY ([zonaId]) REFERENCES [dbo].[zone]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[oggetti] ADD CONSTRAINT [oggetti_camereId_fkey] FOREIGN KEY ([camereId]) REFERENCES [dbo].[camere]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[manutenzioni] ADD CONSTRAINT [manutenzioni_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[strutture]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[manutenzioni] ADD CONSTRAINT [manutenzioni_zonaId_fkey] FOREIGN KEY ([zonaId]) REFERENCES [dbo].[zone]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[manutenzioni] ADD CONSTRAINT [manutenzioni_camereId_fkey] FOREIGN KEY ([camereId]) REFERENCES [dbo].[camere]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[manutenzioni] ADD CONSTRAINT [manutenzioni_oggettoId_fkey] FOREIGN KEY ([oggettoId]) REFERENCES [dbo].[oggetti]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[tempi_registrati] ADD CONSTRAINT [tempi_registrati_manutenzioneId_fkey] FOREIGN KEY ([manutenzioneId]) REFERENCES [dbo].[manutenzioni]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[materiali] ADD CONSTRAINT [materiali_manutenzioneId_fkey] FOREIGN KEY ([manutenzioneId]) REFERENCES [dbo].[manutenzioni]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[storico_modifiche] ADD CONSTRAINT [storico_modifiche_manutenzioneId_fkey] FOREIGN KEY ([manutenzioneId]) REFERENCES [dbo].[manutenzioni]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[manutentori] ADD CONSTRAINT [manutentori_dittaId_fkey] FOREIGN KEY ([dittaId]) REFERENCES [dbo].[ditte]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[manutentori] ADD CONSTRAINT [manutentori_figuraProfessionaleId_fkey] FOREIGN KEY ([figuraProfessionaleId]) REFERENCES [dbo].[figure_professionali]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ticket_utenti] ADD CONSTRAINT [ticket_utenti_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[ticket_strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[tickets] ADD CONSTRAINT [tickets_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[ticket_strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[locker_ordini] ADD CONSTRAINT [locker_ordini_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[locker_strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[locker_locali] ADD CONSTRAINT [locker_locali_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[locker_strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[locker_vendite] ADD CONSTRAINT [locker_vendite_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[locker_strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vending_macchine] ADD CONSTRAINT [vending_macchine_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[vending_strutture]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[vending_vendite] ADD CONSTRAINT [vending_vendite_strutturaId_fkey] FOREIGN KEY ([strutturaId]) REFERENCES [dbo].[vending_strutture]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[vending_vendite] ADD CONSTRAINT [vending_vendite_macchinaId_fkey] FOREIGN KEY ([macchinaId]) REFERENCES [dbo].[vending_macchine]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

