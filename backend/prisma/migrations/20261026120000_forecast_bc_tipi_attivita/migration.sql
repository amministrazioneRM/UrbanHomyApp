BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[forecast_bc_tipi_attivita] (
    [id] NVARCHAR(1000) NOT NULL,
    [codice] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [dataImport] DATETIME2 NOT NULL,
    CONSTRAINT [forecast_bc_tipi_attivita_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_bc_tipi_attivita_codice_key] UNIQUE NONCLUSTERED ([codice])
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
