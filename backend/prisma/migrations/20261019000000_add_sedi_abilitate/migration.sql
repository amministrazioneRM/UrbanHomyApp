BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[utenti_accounts] ADD [sediAbilitate] NVARCHAR(Max) NOT NULL CONSTRAINT [utenti_accounts_sediAbilitate_df] DEFAULT '[]';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
