"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendTransactionalEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function forgotPasswordAction(formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect("/forgot-password?sent=1");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, firstName: true },
  });

  if (user) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { identifier: user.email },
      }),
      prisma.passwordResetToken.create({
        data: {
          identifier: user.email,
          tokenHash,
          expires,
        },
      }),
    ]);

    const baseUrl =
      process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

    await sendTransactionalEmail({
      to: user.email,
      subject: "Réinitialisation de votre mot de passe PulseERP",
      html: `
        <h2>Bonjour ${user.firstName || ""},</h2>
        <p>Une demande de réinitialisation a été effectuée.</p>
        <p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans une heure.</p>
      `,
    });
  }

  redirect("/forgot-password?sent=1");
}
