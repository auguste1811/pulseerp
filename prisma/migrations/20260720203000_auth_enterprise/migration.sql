-- PulseERP v2.2.0 - Auth Enterprise

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "image" TEXT;

ALTER TABLE "users"
  ALTER COLUMN "first_name" SET DEFAULT '',
  ALTER COLUMN "last_name" SET DEFAULT '';

CREATE TABLE IF NOT EXISTS "auth_accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_accounts_provider_provider_account_id_key"
ON "auth_accounts"("provider", "provider_account_id");

CREATE INDEX IF NOT EXISTS "auth_accounts_user_id_idx"
ON "auth_accounts"("user_id");

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" TEXT NOT NULL,
  "session_token" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "expires" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_session_token_key"
ON "auth_sessions"("session_token");

CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_idx"
ON "auth_sessions"("user_id");

CREATE TABLE IF NOT EXISTS "auth_verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_verification_tokens_identifier_token_key"
ON "auth_verification_tokens"("identifier", "token");

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
ON "password_reset_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_identifier_idx"
ON "password_reset_tokens"("identifier");
