-- Ripristina il tipo originale della colonna (alterata per errore dalla migrazione precedente)
ALTER TABLE [dbo].[utenti_accounts] ALTER COLUMN [password] NVARCHAR(MAX) NULL;
