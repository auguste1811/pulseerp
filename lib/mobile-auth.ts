import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type MobileContext = {
  user_id: string;
  company_id: string;
  company_name: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueMobileToken(): string {
  return `pat_${randomBytes(32).toString("base64url")}`;
}

export async function createMobileToken(
  userId: string,
  name = "Application mobile",
): Promise<string> {
  const token = issueMobileToken();
  await prisma.mobileToken.create({
    data: { userId, tokenHash: hashToken(token), name },
  });
  return token;
}

export async function mobileContext(request: Request): Promise<MobileContext | null> {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match) return null;

  const stored = await prisma.mobileToken.findUnique({
    where: { tokenHash: hashToken(match[1]) },
    include: { user: true },
  });
  if (!stored || !stored.user.isActive) return null;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: stored.userId },
    orderBy: { companyId: "asc" },
    include: { company: true },
  });
  if (!membership || membership.company.status !== "ACTIVE") return null;

  await prisma.mobileToken.update({
    where: { id: stored.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    user_id: stored.user.id,
    company_id: membership.company.id,
    company_name: membership.company.name,
    email: stored.user.email,
    first_name: stored.user.firstName,
    last_name: stored.user.lastName,
    role: membership.role,
  };
}
