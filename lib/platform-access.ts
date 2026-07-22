import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const MODULE_CODES = [
  "DASHBOARD",
  "REPORTS",
  "CRM",
  "BILLING",
  "ACCOUNTING",
  "TASKS",
  "CALENDAR",
  "DOCUMENTS",
  "TEAM",
  "AUTOMATIONS",
  "INTEGRATIONS",
  "NOTIFICATIONS",
  "AI",
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

export function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdminIdentity(user: {
  email: string;
  isPlatformAdmin: boolean;
}) {
  return (
    user.isPlatformAdmin ||
    platformAdminEmails().has(user.email.toLowerCase())
  );
}

export async function requirePlatformAdmin() {
  const { auth } = await import("@/auth");
  const session = await auth();

  if (!session?.user?.id) redirect("/developer/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      isPlatformAdmin: true,
    },
  });

  if (!user?.isActive) {
    redirect("/developer/login?error=credentials");
  }

  if (!isPlatformAdminIdentity(user)) {
    notFound();
  }

  return user;
}

export async function getEnabledModuleCodes(companyId: string) {
  const rows = await prisma.companyModule.findMany({
    where: {
      companyId,
      enabled: true,
      module: { isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      module: { select: { code: true } },
    },
  });

  return new Set(rows.map((row) => row.module.code));
}

export async function requireCompanyModule(
  companyId: string,
  code: ModuleCode,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { status: true, accessExpiresAt: true },
  });

  const expired =
    company?.accessExpiresAt &&
    company.accessExpiresAt.getTime() <= Date.now();

  if (!company || company.status !== "ACTIVE" || expired) {
    redirect("/access-suspended");
  }

  const moduleAccess = await prisma.companyModule.findFirst({
    where: {
      companyId,
      enabled: true,
      module: {
        code,
        isActive: true,
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { companyId: true },
  });

  if (!moduleAccess) {
    redirect(`/module-unavailable?module=${encodeURIComponent(code)}`);
  }
}

export async function listPlatformModules() {
  return prisma.appModule.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { position: "asc" }],
  });
}
