CREATE TABLE IF NOT EXISTS "crm_calls" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
  "status" TEXT NOT NULL,
  "outcome" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL,
  "duration_seconds" INTEGER NOT NULL DEFAULT 0,
  "phone_number" TEXT,
  "summary" TEXT,
  "next_action" TEXT,
  "follow_up_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_calls_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_calls_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_calls_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "crm_calls_company_id_started_at_idx" ON "crm_calls"("company_id", "started_at");
CREATE INDEX IF NOT EXISTS "crm_calls_contact_id_started_at_idx" ON "crm_calls"("contact_id", "started_at");
