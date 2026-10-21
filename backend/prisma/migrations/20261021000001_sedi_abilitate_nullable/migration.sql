-- Migration: sedi_abilitate_nullable
-- sediAbilitate = NULL significa "accesso a tutte le sedi" (nessun filtro).
-- La colonna deve accettare NULL per rappresentare questo stato.

ALTER TABLE utenti_accounts
ALTER COLUMN sediAbilitate NVARCHAR(MAX) NULL;
