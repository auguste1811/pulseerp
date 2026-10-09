import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createMobileToken } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id },
    orderBy: { companyId: "asc" },
    include: { company: true },
  });
  if (!membership || membership.company.status !== "ACTIVE") {
    return NextResponse.json({ error: "Aucune entreprise active" }, { status: 403 });
  }

  const token = await createMobileToken(user.id);

  return NextResponse.json({
    token,
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    company: { id: membership.company.id, name: membership.company.name },
    role: membership.role,
  });
}

export async function DELETE(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (match) {
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(match[1]).digest("hex");
    await prisma.mobileToken.deleteMany({ where: { tokenHash } });
  }
  return NextResponse.json({ ok: true });
}
