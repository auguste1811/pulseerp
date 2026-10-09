-- Logo entreprise pour devis/factures et interface
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
