import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("La variable DATABASE_URL est absente du fichier .env");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schemaSql);

    const passwordHash = await bcrypt.hash("Pulse123!", 12);

    const userResult = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      ["demo@pulseerp.fr"],
    );

    let userId = userResult.rows[0]?.id;

    if (!userId) {
      userId = randomUUID();

      await client.query(
        `
        INSERT INTO users (
          id,
          first_name,
          last_name,
          email,
          password_hash
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          userId,
          "Auguste",
          "Martinat",
          "demo@pulseerp.fr",
          passwordHash,
        ],
      );
    }

    const membershipResult = await client.query<{ company_id: string }>(
      `
      SELECT company_id
      FROM company_members
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    let companyId = membershipResult.rows[0]?.company_id;

    if (!companyId) {
      companyId = randomUUID();

      await client.query(
        `
        INSERT INTO companies (
          id,
          name,
          currency,
          default_vat_rate
        )
        VALUES ($1, $2, $3, $4)
        `,
        [companyId, "Pulse Agency", "EUR", 20],
      );

      await client.query(
        `
        INSERT INTO company_members (
          user_id,
          company_id,
          role
        )
        VALUES ($1, $2, $3)
        `,
        [userId, companyId, "OWNER"],
      );
    }

    const contactsCountResult = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM contacts
      WHERE company_id = $1
      `,
      [companyId],
    );

    if (Number(contactsCountResult.rows[0].count) === 0) {
      await client.query(
        `
        INSERT INTO contacts (
          id,
          company_id,
          first_name,
          last_name,
          company_name,
          email,
          source,
          status,
          value
        )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9),
          ($10, $2, $11, $12, $13, $14, $15, $16, $17)
        `,
        [
          randomUUID(),
          companyId,
          "Lucas",
          "Martin",
          "LM Conseil",
          "lucas@example.fr",
          "LinkedIn",
          "NEGOTIATION",
          3500,
          randomUUID(),
          "Emma",
          "Durand",
          "Agence Nova",
          "emma@example.fr",
          "Google Ads",
          "CUSTOMER",
          4800,
        ],
      );
    }

    const transactionsCountResult = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM transactions
      WHERE company_id = $1
      `,
      [companyId],
    );

    if (Number(transactionsCountResult.rows[0].count) === 0) {
      await client.query(
        `
        INSERT INTO transactions (
          id,
          company_id,
          type,
          status,
          date,
          label,
          category,
          amount_excluding_tax,
          vat_rate,
          vat_amount,
          amount_including_tax
        )
        VALUES
          ($1, $2, 'INCOME', 'PAID', CURRENT_DATE, $3, $4, 4800, 20, 960, 5760),
          ($5, $2, 'EXPENSE', 'PAID', CURRENT_DATE, $6, $7, 1500, 20, 300, 1800)
        `,
        [
          randomUUID(),
          companyId,
          "Contrat Agence Nova",
          "Vente",
          randomUUID(),
          "Google Ads",
          "Publicité",
        ],
      );
    }

    const tasksCountResult = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM tasks
      WHERE company_id = $1
      `,
      [companyId],
    );

    if (Number(tasksCountResult.rows[0].count) === 0) {
      await client.query(
        `
        INSERT INTO tasks (
          id,
          company_id,
          title,
          status,
          priority,
          due_date
        )
        VALUES
          ($1, $2, $3, 'TODO', 'HIGH', CURRENT_DATE + 1),
          ($4, $2, $5, 'IN_PROGRESS', 'MEDIUM', CURRENT_DATE + 3)
        `,
        [
          randomUUID(),
          companyId,
          "Relancer Lucas Martin",
          randomUUID(),
          "Préparer le rapport mensuel",
        ],
      );
    }

    await client.query("COMMIT");

    console.log("Base PulseERP initialisée avec succès.");
    console.log("Compte : demo@pulseerp.fr");
    console.log("Mot de passe : Pulse123!");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error("Échec de l'initialisation de la base :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });