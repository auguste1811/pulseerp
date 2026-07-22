ALTER TABLE "transactions"
ADD COLUMN IF NOT EXISTS "revenue_source" TEXT;

CREATE TABLE IF NOT EXISTS "acquisition_channels" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manager_user_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "acquisition_channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "acquisition_channels_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "acquisition_channels_manager_user_id_fkey"
    FOREIGN KEY ("manager_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "acquisition_channels_company_id_code_key"
ON "acquisition_channels"("company_id", "code");

CREATE INDEX IF NOT EXISTS "acquisition_channels_company_id_is_active_idx"
ON "acquisition_channels"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "acquisition_metrics" (
  "id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "month" DATE NOT NULL,
  "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "attributed_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "acquisition_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "acquisition_metrics_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "acquisition_channels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "acquisition_metrics_channel_id_month_key"
ON "acquisition_metrics"("channel_id", "month");

CREATE INDEX IF NOT EXISTS "acquisition_metrics_month_idx"
ON "acquisition_metrics"("month");

INSERT INTO "app_modules"
  ("id", "code", "name", "description", "category", "route", "icon", "position")
VALUES
  ('module-acquisition', 'ACQUISITION', 'Sources d’acquisition',
   'Suivi des leads, dépenses, revenus et coût par lead.',
   'Ventes', '/acquisition', 'reports', 35)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "route" = EXCLUDED."route",
  "icon" = EXCLUDED."icon",
  "position" = EXCLUDED."position",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "company_modules" ("company_id", "module_id", "enabled")
SELECT c."id", m."id", TRUE
FROM "companies" c
JOIN "app_modules" m ON m."code" = 'ACQUISITION'
ON CONFLICT ("company_id", "module_id") DO NOTHING;

INSERT INTO "acquisition_channels"
  ("id", "company_id", "code", "name")
SELECT
  md5(c."id" || source.code),
  c."id",
  source.code,
  source.name
FROM "companies" c
CROSS JOIN (
  VALUES
    ('ADS', 'Ads'),
    ('CLIPPING', 'Clipping'),
    ('UGC_AFFILIATE', 'UGC / Affilié'),
    ('INFLUENCER', 'Influenceur'),
    ('ORGANIC', 'Organique'),
    ('COMPARISON_SITE', 'Site comparatif')
) AS source(code, name)
ON CONFLICT ("company_id", "code") DO NOTHING;
