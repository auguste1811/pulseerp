"use server";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pool } from "@/lib/db";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    companyName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(10).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas.",
  });

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) redirect("/register?error=invalid");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
      [parsed.data.email],
    );

    if (existing.rowCount) {
      await client.query("ROLLBACK");
      redirect("/register?error=exists");
    }

    const userId = randomUUID();
    const companyId = randomUUID();
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await client.query(
      `
      INSERT INTO users (
        id, first_name, last_name, email, password_hash, is_active
      )
      VALUES ($1, $2, $3, $4, $5, TRUE)
      `,
      [
        userId,
        parsed.data.firstName,
        parsed.data.lastName,
        parsed.data.email,
        passwordHash,
      ],
    );

    await client.query(
      `
      INSERT INTO companies (id, name, currency, default_vat_rate)
      VALUES ($1, $2, 'EUR', 20)
      `,
      [companyId, parsed.data.companyName],
    );

    await client.query(
      `
      INSERT INTO company_members (user_id, company_id, role)
      VALUES ($1, $2, 'OWNER')
      `,
      [userId, companyId],
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }

  redirect("/login?created=1");
}
