ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "is_platform_admin" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "access_expires_at" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "app_modules" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "route" TEXT,
  "icon" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_modules_code_key"
ON "app_modules"("code");

CREATE TABLE IF NOT EXISTS "company_modules" (
  "company_id" TEXT NOT NULL,
  "module_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_modules_pkey" PRIMARY KEY ("company_id", "module_id"),
  CONSTRAINT "company_modules_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_modules_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "app_modules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "company_modules_company_id_enabled_idx"
ON "company_modules"("company_id", "enabled");

INSERT INTO "app_modules"
  ("id", "code", "name", "description", "category", "route", "icon", "position")
VALUES
  ('module-dashboard', 'DASHBOARD', 'Tableau de bord', 'Pilotage général de l’entreprise.', 'Pilotage', '/dashboard', 'dashboard', 10),
  ('module-reports', 'REPORTS', 'Rapports', 'Rapports et indicateurs détaillés.', 'Pilotage', '/reports', 'reports', 20),
  ('module-crm', 'CRM', 'CRM', 'Contacts, prospects et pipeline commercial.', 'Ventes', '/contacts', 'crm', 30),
  ('module-billing', 'BILLING', 'Devis & factures', 'Création et suivi des documents commerciaux.', 'Ventes', '/billing', 'documents', 40),
  ('module-accounting', 'ACCOUNTING', 'Comptabilité', 'Achats, ventes, TVA et écritures.', 'Ventes', '/transactions', 'accounting', 50),
  ('module-tasks', 'TASKS', 'Tâches', 'Organisation et suivi du travail.', 'Organisation', '/tasks', 'tasks', 60),
  ('module-calendar', 'CALENDAR', 'Calendrier', 'Rendez-vous, échéances et relances.', 'Organisation', '/calendar', 'calendar', 70),
  ('module-documents', 'DOCUMENTS', 'Documents', 'Classement et gestion documentaire.', 'Organisation', '/documents', 'documents', 80),
  ('module-team', 'TEAM', 'Équipe', 'Utilisateurs, rôles et invitations.', 'Organisation', '/team', 'team', 90),
  ('module-automations', 'AUTOMATIONS', 'Automatisations', 'Règles et scénarios automatiques.', 'Intelligence', '/automations', 'sparkles', 100),
  ('module-integrations', 'INTEGRATIONS', 'App Center', 'Connecteurs et services externes.', 'Intelligence', '/integrations', 'settings', 110),
  ('module-notifications', 'NOTIFICATIONS', 'Notifications', 'Centre de notifications.', 'Intelligence', '/notifications', 'bell', 120),
  ('module-ai', 'AI', 'PulseAI', 'Assistant intelligent, bientôt disponible.', 'Intelligence', '/ai', 'sparkles', 130)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "route" = EXCLUDED."route",
  "icon" = EXCLUDED."icon",
  "position" = EXCLUDED."position",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

-- Toutes les entreprises existantes conservent tous leurs modules.
INSERT INTO "company_modules" ("company_id", "module_id", "enabled")
SELECT c."id", m."id", TRUE
FROM "companies" c
CROSS JOIN "app_modules" m
ON CONFLICT ("company_id", "module_id") DO NOTHING;
