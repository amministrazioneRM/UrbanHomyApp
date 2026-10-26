BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[forecast_bc_strutture] (
    [id] NVARCHAR(1000) NOT NULL,
    [societa] NVARCHAR(1000) NOT NULL,
    [codice] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [bloccata] BIT NOT NULL CONSTRAINT [forecast_bc_strutture_bloccata_df] DEFAULT 0,
    [dataImport] DATETIME2 NOT NULL,
    CONSTRAINT [forecast_bc_strutture_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_bc_strutture_societa_codice_key] UNIQUE NONCLUSTERED ([societa],[codice])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
