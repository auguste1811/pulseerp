CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'TRIAL',
  "status" TEXT NOT NULL DEFAULT 'TRIALING',
  "trial_starts_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trial_ends_at" TIMESTAMPTZ NOT NULL,
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "stripe_price_id" TEXT,
  "current_period_end" TIMESTAMPTZ,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_company_id_key"
ON "subscriptions"("company_id");

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_customer_id_key"
ON "subscriptions"("stripe_customer_id")
WHERE "stripe_customer_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_key"
ON "subscriptions"("stripe_subscription_id")
WHERE "stripe_subscription_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "subscriptions_status_trial_ends_at_idx"
ON "subscriptions"("status", "trial_ends_at");

-- Les espaces déjà existants reçoivent eux aussi trois jours à partir
-- de l'installation de cette migration.
INSERT INTO "subscriptions" (
  "id", "company_id", "plan", "status",
  "trial_starts_at", "trial_ends_at",
  "created_at", "updated_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || c."id"),
  c."id",
  'TRIAL',
  'TRIALING',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '3 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "subscriptions" s
  WHERE s."company_id" = c."id"
);
