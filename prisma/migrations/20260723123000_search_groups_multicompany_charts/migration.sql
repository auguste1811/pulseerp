CREATE TABLE IF NOT EXISTS "contact_groups" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#6653E8',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contact_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_groups_company_id_name_key" ON "contact_groups"("company_id", "name");
CREATE INDEX IF NOT EXISTS "contact_groups_company_id_idx" ON "contact_groups"("company_id");

CREATE TABLE IF NOT EXISTS "contact_group_members" (
  "group_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_group_members_pkey" PRIMARY KEY ("group_id", "contact_id"),
  CONSTRAINT "contact_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "contact_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contact_group_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "contact_group_members_contact_id_idx" ON "contact_group_members"("contact_id");
