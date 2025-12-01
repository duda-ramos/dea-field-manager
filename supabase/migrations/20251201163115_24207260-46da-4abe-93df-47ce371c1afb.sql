-- Alterar coluna quantidade para aceitar decimais (até 2 casas)
ALTER TABLE installations
ALTER COLUMN quantidade TYPE numeric(10,2);