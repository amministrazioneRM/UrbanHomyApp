BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[forecast_voce_tipi_attivita] (
    [id] NVARCHAR(1000) NOT NULL,
    [voceId] NVARCHAR(1000) NOT NULL,
    [codice] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [forecast_voce_tipi_attivita_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_voce_tipi_attivita_codice_key] UNIQUE NONCLUSTERED ([codice])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [forecast_voce_tipi_attivita_voceId_idx] ON [dbo].[forecast_voce_tipi_attivita]([voceId]);

-- AddForeignKey
ALTER TABLE [dbo].[forecast_voce_tipi_attivita] ADD CONSTRAINT [forecast_voce_tipi_attivita_voceId_fkey] FOREIGN KEY ([voceId]) REFERENCES [dbo].[forecast_voci]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
