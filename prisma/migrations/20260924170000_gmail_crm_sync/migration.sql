CREATE TABLE "crm_emails" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "imported_by_id" TEXT,
  "gmail_message_id" TEXT NOT NULL,
  "gmail_thread_id" TEXT,
  "from_email" TEXT NOT NULL,
  "from_name" TEXT,
  "to_email" TEXT,
  "subject" TEXT NOT NULL,
  "snippet" TEXT,
  "body_text" TEXT,
  "received_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_emails_company_id_gmail_message_id_key"
ON "crm_emails"("company_id", "gmail_message_id");

CREATE INDEX "crm_emails_company_id_contact_id_received_at_idx"
ON "crm_emails"("company_id", "contact_id", "received_at" DESC);

ALTER TABLE "crm_emails"
ADD CONSTRAINT "crm_emails_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_emails"
ADD CONSTRAINT "crm_emails_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_emails"
ADD CONSTRAINT "crm_emails_imported_by_id_fkey"
FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
