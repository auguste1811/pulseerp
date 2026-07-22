INSERT INTO "app_modules"
  ("id", "code", "name", "description", "category", "route", "icon", "position")
VALUES
  (
    'module-acquisition',
    'ACQUISITION',
    'Sources d’acquisition',
    'Suivi des leads, dépenses, revenus et coût par lead.',
    'Ventes',
    '/acquisition',
    'reports',
    35
  )
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
ON CONFLICT ("company_id", "module_id")
DO UPDATE SET "enabled" = TRUE, "updated_at" = CURRENT_TIMESTAMP;
