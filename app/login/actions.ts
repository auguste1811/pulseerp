"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { query } from "@/lib/db";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/login?error=invalid");

  const rows = await query<any>(
    `
    SELECT
      u.id,
      u.email,
      u.password_hash,
      cm.company_id
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE u.email = $1
      AND u.is_active = TRUE
    ORDER BY cm.role = 'OWNER' DESC
    LIMIT 1
    `,
    [parsed.data.email],
  );

  const user = rows[0];
  const valid = user
    ? await bcrypt.compare(parsed.data.password, user.password_hash)
    : false;

  if (!valid) redirect("/login?error=credentials");

  await query(
    "UPDATE users SET last_login_at = NOW() WHERE id = $1",
    [user.id],
  );

  await createSession({
    userId: user.id,
    companyId: user.company_id,
    email: user.email,
  });

  redirect("/dashboard");
}
