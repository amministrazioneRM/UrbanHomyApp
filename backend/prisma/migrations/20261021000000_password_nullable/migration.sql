-- Migration: password_nullable
-- Rende il campo password nullable su utenti_accounts.
-- Gli utenti non-admin (ruolo_globale != 'Amministratore') accedono solo
-- tramite SSO Microsoft e non devono avere password nel DB.

BEGIN TRANSACTION;

-- 1. Altera la colonna per consentire NULL (deve venire prima dell'UPDATE)
ALTER TABLE utenti_accounts
ALTER COLUMN password NVARCHAR(MAX) NULL;

-- 2. Azzera le password degli utenti non-admin
UPDATE utenti_accounts
SET password = NULL
WHERE ruoloGlobale != 'Amministratore';

COMMIT;
