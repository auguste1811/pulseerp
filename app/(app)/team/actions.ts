"use server";

import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pool, query } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

const roles = ["ADMIN", "MANAGER", "EMPLOYEE", "VIEWER"] as const;

export async function createTeamMember(formData: FormData) {
  const member = await requireRole("ADMIN");

  const parsed = z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(roles),
    password: z.string().min(10).max(128),
  }).safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/team?error=invalid");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email=$1 LIMIT 1",
      [parsed.data.email],
    );

    let userId = existing.rows[0]?.id;

    if (!userId) {
      userId = randomUUID();
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);

      await client.query(
        `
        INSERT INTO users (
          id, first_name, last_name, email, password_hash,
          is_active, email_verified_at
        )
        VALUES ($1,$2,$3,$4,$5,TRUE,NOW())
        `,
        [
          userId,
          parsed.data.firstName,
          parsed.data.lastName,
          parsed.data.email,
          passwordHash,
        ],
      );
    }

    const membership = await client.query(
      `
      SELECT 1
      FROM company_members
      WHERE user_id=$1 AND company_id=$2
      `,
      [userId, member.company_id],
    );

    if (membership.rowCount) {
      await client.query("ROLLBACK");
      redirect("/team?error=exists");
    }

    await client.query(
      `
      INSERT INTO company_members (user_id, company_id, role)
      VALUES ($1,$2,$3)
      `,
      [userId, member.company_id, parsed.data.role],
    );

    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/team");
  redirect("/team?created=1");
}

export async function updateMemberRole(formData: FormData) {
  const member = await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!roles.includes(role as (typeof roles)[number])) {
    redirect("/team?error=role");
  }

  await query(
    `
    UPDATE company_members
    SET role=$3
    WHERE user_id=$1
      AND company_id=$2
      AND role<>'OWNER'
    `,
    [userId, member.company_id, role],
  );

  revalidatePath("/team");
  redirect("/team?saved=1");
}

export async function toggleMemberActive(formData: FormData) {
  const member = await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");

  if (userId === member.user_id) {
    redirect("/team?error=self");
  }

  await query(
    `
    UPDATE users u
    SET is_active = NOT u.is_active
    FROM company_members cm
    WHERE u.id=$1
      AND cm.user_id=u.id
      AND cm.company_id=$2
      AND cm.role<>'OWNER'
    `,
    [userId, member.company_id],
  );

  revalidatePath("/team");
  redirect("/team?saved=1");
}

export async function removeMember(formData: FormData) {
  const member = await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");

  if (userId === member.user_id) {
    redirect("/team?error=self");
  }

  await query(
    `
    DELETE FROM company_members
    WHERE user_id=$1
      AND company_id=$2
      AND role<>'OWNER'
    `,
    [userId, member.company_id],
  );

  revalidatePath("/team");
  redirect("/team?removed=1");
}
