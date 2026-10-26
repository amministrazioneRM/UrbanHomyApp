BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[forecast_mews_categorie] (
    [id] NVARCHAR(1000) NOT NULL,
    [mewsId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [classificazione] NVARCHAR(1000),
    [societa] NVARCHAR(1000) NOT NULL,
    [codiceAttivita] NVARCHAR(1000),
    [dataImport] DATETIME2 NOT NULL,
    CONSTRAINT [forecast_mews_categorie_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [forecast_mews_categorie_mewsId_key] UNIQUE NONCLUSTERED ([mewsId])
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
