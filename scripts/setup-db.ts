import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL est absente.");

const pool = new Pool({ connectionString: databaseUrl });

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_id TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique
ON users(google_id)
WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  default_vat_rate NUMERIC NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'PROSPECT',
  value NUMERIC NOT NULL DEFAULT 0,
  address TEXT,
  siret TEXT,
  vat_number TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  tags TEXT[] NOT NULL DEFAULT '{}',
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS contacts_company_status_idx
ON contacts(company_id, status);

CREATE INDEX IF NOT EXISTS contacts_company_email_idx
ON contacts(company_id, LOWER(email));

CREATE TABLE IF NOT EXISTS contact_notes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_notes_contact_idx
ON contact_notes(company_id, contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_activities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_activities_contact_idx
ON contact_activities(company_id, contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  date DATE NOT NULL,
  label TEXT NOT NULL,
  category TEXT,
  amount_excluding_tax NUMERIC NOT NULL,
  vat_rate NUMERIC NOT NULL,
  vat_amount NUMERIC NOT NULL,
  amount_including_tax NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS sales_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('QUOTE','INVOICE')),
  document_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  valid_until DATE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  source_quote_id TEXT REFERENCES sales_documents(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, document_number)
);

CREATE INDEX IF NOT EXISTS sales_documents_company_type_idx
ON sales_documents(company_id, document_type, issue_date DESC);

CREATE INDEX IF NOT EXISTS sales_documents_contact_idx
ON sales_documents(company_id, contact_id);

CREATE TABLE IF NOT EXISTS sales_document_items (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 20,
  line_subtotal NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sales_document_items_document_idx
ON sales_document_items(document_id, position);


ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'France';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bic TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_footer TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_validity_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_prefix TEXT NOT NULL DEFAULT 'DEV';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'FAC';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS document_sequences (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('QUOTE','INVOICE')),
  year INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(company_id, document_type, year)
);





ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS tasks_company_assignee_idx
ON tasks(company_id, assigned_user_id, status);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  token TEXT UNIQUE NOT NULL,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitations_company_email_idx
ON invitations(company_id, LOWER(email));

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_company_created_idx
ON documents(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_contact_idx
ON documents(company_id, contact_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'MEETING',
  status TEXT NOT NULL DEFAULT 'PLANNED',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  reminder_minutes INTEGER NOT NULL DEFAULT 30,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_events_company_start_idx
ON calendar_events(company_id, start_at);

CREATE INDEX IF NOT EXISTS calendar_events_contact_idx
ON calendar_events(company_id, contact_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'TODO',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schemaSql);

    const passwordHash = await bcrypt.hash("Pulse123!", 12);
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      ["demo@pulseerp.fr"],
    );

    let userId = existing.rows[0]?.id;

    if (!userId) {
      userId = randomUUID();
      await client.query(
        `
        INSERT INTO users (
          id, first_name, last_name, email, password_hash,
          is_active, email_verified_at
        )
        VALUES ($1, 'Auguste', 'Martinat', $2, $3, TRUE, NOW())
        `,
        [userId, "demo@pulseerp.fr", passwordHash],
      );
    }

    const membership = await client.query<{ company_id: string }>(
      `
      SELECT company_id
      FROM company_members
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    let companyId = membership.rows[0]?.company_id;

    if (!companyId) {
      companyId = randomUUID();
      await client.query(
        "INSERT INTO companies(id, name) VALUES ($1, $2)",
        [companyId, "Pulse Agency"],
      );
      await client.query(
        `
        INSERT INTO company_members(user_id, company_id, role)
        VALUES ($1, $2, 'OWNER')
        `,
        [userId, companyId],
      );
    }

    const contactCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM contacts WHERE company_id = $1",
      [companyId],
    );

    if (Number(contactCount.rows[0].count) === 0) {
      await client.query(
        `
        INSERT INTO contacts(
          id, company_id, first_name, last_name, company_name,
          email, source, status, value
        )
        VALUES
          ($1, $2, 'Lucas', 'Martin', 'LM Conseil',
           'lucas@example.fr', 'LinkedIn', 'NEGOTIATION', 3500),
          ($3, $2, 'Emma', 'Durand', 'Agence Nova',
           'emma@example.fr', 'Google Ads', 'CUSTOMER', 4800)
        `,
        [randomUUID(), companyId, randomUUID()],
      );
    }

    const transactionCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM transactions WHERE company_id = $1",
      [companyId],
    );

    if (Number(transactionCount.rows[0].count) === 0) {
      await client.query(
        `
        INSERT INTO transactions(
          id, company_id, type, status, date, label, category,
          amount_excluding_tax, vat_rate, vat_amount, amount_including_tax
        )
        VALUES
          ($1, $2, 'INCOME', 'PAID', CURRENT_DATE,
           'Contrat Agence Nova', 'Vente', 4800, 20, 960, 5760),
          ($3, $2, 'EXPENSE', 'PAID', CURRENT_DATE,
           'Google Ads', 'Publicité', 1500, 20, 300, 1800)
        `,
        [randomUUID(), companyId, randomUUID()],
      );
    }

    const taskCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM tasks WHERE company_id = $1",
      [companyId],
    );

    if (Number(taskCount.rows[0].count) === 0) {
      await client.query(
        `
        INSERT INTO tasks(
          id, company_id, title, status, priority, due_date
        )
        VALUES
          ($1, $2, 'Relancer Lucas Martin', 'TODO', 'HIGH', CURRENT_DATE + 1),
          ($3, $2, 'Préparer le rapport mensuel',
           'IN_PROGRESS', 'MEDIUM', CURRENT_DATE + 3)
        `,
        [randomUUID(), companyId, randomUUID()],
      );
    }

    await client.query("COMMIT");
    console.log("Base PulseERP Paramètres v0.8.0 initialisée.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
