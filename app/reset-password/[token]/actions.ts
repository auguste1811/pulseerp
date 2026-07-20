"use server";

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    token: z.string().min(20),
    password: z.string().min(10).max(128),
    confirmation: z.string().min(10).max(128),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
  });

export async function resetPasswordAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    redirect(
      `/reset-password/${encodeURIComponent(
        String(formData.get("token") || ""),
      )}?error=invalid`,
    );
  }

  const tokenHash = createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.expires < new Date()) {
    redirect("/forgot-password?expired=1");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: resetToken.identifier },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { identifier: resetToken.identifier },
    }),
  ]);

  redirect("/login?reset=1");
}
