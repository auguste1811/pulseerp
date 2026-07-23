CREATE TABLE IF NOT EXISTS "sales_document_emails" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider_id" TEXT,
  "error_message" TEXT,
  "sent_by" TEXT,
  "sent_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_document_emails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_document_emails_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_document_emails_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "sales_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_document_emails_sent_by_fkey"
    FOREIGN KEY ("sent_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "sales_document_emails_document_id_created_at_idx"
ON "sales_document_emails"("document_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "sales_document_emails_company_id_created_at_idx"
ON "sales_document_emails"("company_id", "created_at" DESC);
