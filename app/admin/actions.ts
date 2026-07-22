"use server";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  MODULE_CODES,
  requirePlatformAdmin,
  type ModuleCode,
} from "@/lib/platform-access";

const companySchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  ownerFirstName: z.string().trim().min(1).max(80),
  ownerLastName: z.string().trim().min(1).max(80),
  ownerEmail: z.string().trim().toLowerCase().email(),
  temporaryPassword: z.string().min(10).max(128),
  accessExpiresAt: z.string().optional(),
});

export async function createManagedCompany(formData: FormData) {
  await requirePlatformAdmin();

  const parsed = companySchema.safeParse({
    companyName: formData.get("companyName"),
    ownerFirstName: formData.get("ownerFirstName"),
    ownerLastName: formData.get("ownerLastName"),
    ownerEmail: formData.get("ownerEmail"),
    temporaryPassword: formData.get("temporaryPassword"),
    accessExpiresAt: formData.get("accessExpiresAt") || "",
  });

  if (!parsed.success) redirect("/admin/new?error=invalid");

  const selectedModules = MODULE_CODES.filter(
    (code) => formData.get(`module_${code}`) === "on",
  );

  if (selectedModules.length === 0) {
    redirect("/admin/new?error=modules");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.ownerEmail },
    select: { id: true },
  });

  if (existingUser) redirect("/admin/new?error=email");

  const passwordHash = await bcrypt.hash(
    parsed.data.temporaryPassword,
    12,
  );

  const accessExpiresAt = parsed.data.accessExpiresAt
    ? new Date(`${parsed.data.accessExpiresAt}T23:59:59.999Z`)
    : null;

  const companyId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const modules = await tx.appModule.findMany({
      where: { code: { in: selectedModules } },
      select: { id: true },
    });

    const user = await tx.user.create({
      data: {
        firstName: parsed.data.ownerFirstName,
        lastName: parsed.data.ownerLastName,
        name: `${parsed.data.ownerFirstName} ${parsed.data.ownerLastName}`,
        email: parsed.data.ownerEmail,
        passwordHash,
        emailVerified: new Date(),
        isActive: true,
      },
    });

    await tx.company.create({
      data: {
        id: companyId,
        name: parsed.data.companyName,
        status: "ACTIVE",
        accessExpiresAt,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        subscription: {
          create: {
            plan: "MANAGED",
            status: "ACTIVE",
            trialEndsAt: accessExpiresAt || new Date("2099-12-31T23:59:59.999Z"),
            currentPeriodEnd: accessExpiresAt,
          },
        },
        enabledModules: {
          create: modules.map((module) => ({
            moduleId: module.id,
            enabled: true,
            expiresAt: accessExpiresAt,
          })),
        },
      },
    });
  });

  revalidatePath("/admin");
  redirect(`/admin/companies/${companyId}?created=1`);
}

export async function updateCompanyModules(formData: FormData) {
  await requirePlatformAdmin();

  const companyId = String(formData.get("companyId") || "");
  if (!companyId) redirect("/admin");

  const modules = await prisma.appModule.findMany({
    where: { isActive: true },
    select: { id: true, code: true },
  });

  await prisma.$transaction(
    modules.map((module) =>
      prisma.companyModule.upsert({
        where: {
          companyId_moduleId: {
            companyId,
            moduleId: module.id,
          },
        },
        update: {
          enabled: formData.get(`module_${module.code}`) === "on",
        },
        create: {
          companyId,
          moduleId: module.id,
          enabled: formData.get(`module_${module.code}`) === "on",
        },
      }),
    ),
  );

  revalidatePath("/admin");
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}?modulesSaved=1`);
}

export async function updateCompanyAccess(formData: FormData) {
  await requirePlatformAdmin();

  const companyId = String(formData.get("companyId") || "");
  const status = String(formData.get("status") || "ACTIVE");
  const rawExpiration = String(formData.get("accessExpiresAt") || "");

  if (!companyId || !["ACTIVE", "SUSPENDED"].includes(status)) {
    redirect("/admin");
  }

  const accessExpiresAt = rawExpiration
    ? new Date(`${rawExpiration}T23:59:59.999Z`)
    : null;

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { status, accessExpiresAt },
    }),
    prisma.companyModule.updateMany({
      where: { companyId },
      data: { expiresAt: accessExpiresAt },
    }),
    prisma.subscription.updateMany({
      where: { companyId },
      data: {
        status: status === "ACTIVE" ? "ACTIVE" : "PAUSED",
        currentPeriodEnd: accessExpiresAt,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}?accessSaved=1`);
}


function selectedCompanyIds(formData: FormData): string[] {
  return Array.from(
    new Set(
      formData
        .getAll("companyIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
}

async function protectedCompanyIds(adminUserId: string): Promise<Set<string>> {
  const memberships = await prisma.companyMember.findMany({
    where: { userId: adminUserId },
    select: { companyId: true },
  });

  return new Set(memberships.map((membership) => membership.companyId));
}

export async function deleteManagedCompany(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") || "").trim();
  const confirmation = String(formData.get("confirmation") || "");

  if (!companyId || confirmation !== "DELETE") {
    redirect(`/admin/companies/${companyId}?deleteError=confirmation`);
  }

  const protectedIds = await protectedCompanyIds(admin.id);

  if (protectedIds.has(companyId)) {
    redirect(`/admin/companies/${companyId}?deleteError=protected`);
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    redirect("/admin?deleteError=not-found");
  }

  await prisma.company.delete({
    where: { id: companyId },
  });

  revalidatePath("/admin");
  redirect(
    `/admin?deleted=1&company=${encodeURIComponent(company.name)}`,
  );
}

export async function deleteSelectedCompanies(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const ids = selectedCompanyIds(formData);
  const confirmation = String(formData.get("bulkConfirmation") || "");

  if (ids.length === 0) {
    redirect("/admin?deleteError=selection");
  }

  if (confirmation !== "DELETE") {
    redirect("/admin?deleteError=confirmation");
  }

  const protectedIds = await protectedCompanyIds(admin.id);
  const deletableIds = ids.filter((id) => !protectedIds.has(id));

  if (deletableIds.length === 0) {
    redirect("/admin?deleteError=protected");
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: deletableIds } },
    select: { id: true },
  });

  if (companies.length === 0) {
    redirect("/admin?deleteError=not-found");
  }

  await prisma.company.deleteMany({
    where: { id: { in: companies.map((company) => company.id) } },
  });

  revalidatePath("/admin");

  const skipped = ids.length - companies.length;
  redirect(
    `/admin?bulkDeleted=${companies.length}&skipped=${Math.max(0, skipped)}`,
  );
}
