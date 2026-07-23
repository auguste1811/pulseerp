"use server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function switchCompany(formData: FormData) {
  const member = await currentContext();
  const companyId = String(formData.get("companyId") || "");
  const membership = await prisma.companyMember.findUnique({
    where: { userId_companyId: { userId: member.user_id, companyId } },
    select: { companyId: true },
  });
  if (!membership) redirect("/companies?error=forbidden");
  const store = await cookies();
  store.set("pulseerp_active_company", companyId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60*60*24*365 });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function createCompany(formData: FormData) {
  const member = await currentContext();
  const parsed = z.object({ name: z.string().trim().min(2).max(160) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect("/companies?error=invalid");
  const companyId = randomUUID();
  await prisma.$transaction(async (tx) => {
    const modules = await tx.appModule.findMany({ where: { isActive: true }, select: { id: true } });
    await tx.company.create({
      data: {
        id: companyId,
        name: parsed.data.name,
        members: { create: { userId: member.user_id, role: "OWNER" } },
        subscription: { create: { plan: "MANAGED", status: "ACTIVE", trialEndsAt: new Date("2099-12-31T23:59:59.999Z") } },
        enabledModules: { create: modules.map((item) => ({ moduleId: item.id, enabled: true })) },
      },
    });
  });
  const store = await cookies();
  store.set("pulseerp_active_company", companyId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60*60*24*365 });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
