BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[forecast_mews_classificazioni] (
    [classificazione] NVARCHAR(1000) NOT NULL,
    [codiceAttivita] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [forecast_mews_classificazioni_pkey] PRIMARY KEY CLUSTERED ([classificazione])
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
