ALTER TABLE "purchase_invoices"
  ADD COLUMN IF NOT EXISTS "ocr_status" TEXT NOT NULL DEFAULT 'NOT_ANALYZED',
  ADD COLUMN IF NOT EXISTS "ocr_confidence" DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS "ocr_data" JSONB,
  ADD COLUMN IF NOT EXISTS "ocr_error" TEXT,
  ADD COLUMN IF NOT EXISTS "ocr_analyzed_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "purchase_invoices_company_ocr_status_idx"
ON "purchase_invoices"("company_id", "ocr_status");
