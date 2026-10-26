BEGIN TRY

BEGIN TRAN;

-- La tabella viene ricaricata dallo script di import
DELETE FROM [dbo].[forecast_bc_strutture];

ALTER TABLE [dbo].[forecast_bc_strutture] DROP CONSTRAINT [forecast_bc_strutture_societa_codice_key];
ALTER TABLE [dbo].[forecast_bc_strutture] DROP CONSTRAINT [forecast_bc_strutture_bloccata_df];
ALTER TABLE [dbo].[forecast_bc_strutture] DROP COLUMN [societa], [bloccata];
ALTER TABLE [dbo].[forecast_bc_strutture] ADD CONSTRAINT [forecast_bc_strutture_codice_key] UNIQUE NONCLUSTERED ([codice]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
