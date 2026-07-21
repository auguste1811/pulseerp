ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "sales_document_id" TEXT,
  ADD COLUMN IF NOT EXISTS "purchase_invoice_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_sales_document_id_key"
ON "transactions"("sales_document_id");

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_purchase_invoice_id_key"
ON "transactions"("purchase_invoice_id");

DO $$ BEGIN
  ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_sales_document_id_fkey"
    FOREIGN KEY ("sales_document_id") REFERENCES "sales_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "purchase_invoices" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "uploaded_by" TEXT,
  "supplier_name" TEXT NOT NULL,
  "invoice_number" TEXT,
  "issue_date" DATE NOT NULL,
  "due_date" DATE,
  "category" TEXT NOT NULL DEFAULT 'TO_CLASSIFY',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "file_data" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoices_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "purchase_invoices_company_id_issue_date_idx"
ON "purchase_invoices"("company_id", "issue_date" DESC);
CREATE INDEX IF NOT EXISTS "purchase_invoices_company_id_category_status_idx"
ON "purchase_invoices"("company_id", "category", "status");

DO $$ BEGIN
  ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_purchase_invoice_id_fkey"
    FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "accounting_entries" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "purchase_invoice_id" TEXT,
  "entry_date" DATE NOT NULL,
  "journal" TEXT NOT NULL,
  "account_number" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounting_entries_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "accounting_entries_company_id_entry_date_idx"
ON "accounting_entries"("company_id", "entry_date" DESC);
CREATE INDEX IF NOT EXISTS "accounting_entries_purchase_invoice_id_idx"
ON "accounting_entries"("purchase_invoice_id");


-- Backfill des factures de vente déjà existantes dans la comptabilité.
INSERT INTO "transactions" (
  "id", "company_id", "type", "status", "date", "label", "category",
  "amount_excluding_tax", "vat_rate", "vat_amount", "amount_including_tax",
  "sales_document_id", "created_at"
)
SELECT
  gen_random_uuid()::text, d."company_id", 'INCOME',
  CASE WHEN d."status"='PAID' THEN 'PAID' WHEN d."status"='OVERDUE' THEN 'OVERDUE' ELSE 'PENDING' END,
  d."issue_date", 'Facture ' || d."document_number", 'Vente', d."subtotal",
  CASE WHEN d."subtotal" > 0 THEN ROUND((d."vat_amount" / d."subtotal") * 100, 2) ELSE 0 END,
  d."vat_amount", d."total", d."id", CURRENT_TIMESTAMP
FROM "sales_documents" d
WHERE d."document_type"='INVOICE' AND d."status" <> 'CANCELLED'
ON CONFLICT ("sales_document_id") DO NOTHING;
