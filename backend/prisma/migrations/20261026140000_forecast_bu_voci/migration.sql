BEGIN TRY

BEGIN TRAN;

-- La vecchia associazione voce -> tipi attivita non e' piu usata (le voci derivano dai tipi attivita di BC)
DROP TABLE [dbo].[forecast_voce_tipi_attivita];

-- CreateTable
CREATE TABLE [dbo].[forecast_bu_voci] (
    [id] NVARCHAR(1000) NOT NULL,
    [buId] NVARCHAR(1000) NOT NULL,
    [voceId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [forecast_bu_voci_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_bu_voci_buId_voceId_key] UNIQUE NONCLUSTERED ([buId],[voceId])
);

-- AddForeignKey
ALTER TABLE [dbo].[forecast_bu_voci] ADD CONSTRAINT [forecast_bu_voci_buId_fkey] FOREIGN KEY ([buId]) REFERENCES [dbo].[forecast_bu]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[forecast_bu_voci] ADD CONSTRAINT [forecast_bu_voci_voceId_fkey] FOREIGN KEY ([voceId]) REFERENCES [dbo].[forecast_voci]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
