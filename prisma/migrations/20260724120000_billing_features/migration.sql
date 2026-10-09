-- Avoirs, acomptes/paiements et signature électronique des devis
ALTER TABLE companies ADD COLUMN IF NOT EXISTS credit_prefix TEXT NOT NULL DEFAULT 'AVO';

ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS source_invoice_id TEXT;
ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS signed_by TEXT;

CREATE TABLE IF NOT EXISTS document_payments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_payments_document_idx
  ON document_payments(document_id, paid_at);
