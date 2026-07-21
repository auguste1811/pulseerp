import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionAccess } from "@/lib/subscription";
import { getEnabledModuleCodes, isPlatformAdminIdentity } from "@/lib/platform-access";

export type SessionPayload = {
  userId: string;
  companyId: string;
  email: string;
};

export async function readSession(): Promise<SessionPayload | null> {
  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.companyId ||
    !session.user.email
  ) {
    return null;
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    email: session.user.email,
  };
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}

export async function deleteSession(): Promise<void> {
  await signOut({ redirect: false });
}

export async function currentContext(options?: { allowExpired?: boolean }) {
  const session = await requireSession();

  const membership = await prisma.companyMember.findUnique({
    where: {
      userId_companyId: {
        userId: session.userId,
        companyId: session.companyId,
      },
    },
    include: {
      user: true,
      company: true,
    },
  });

  if (!membership || !membership.user.isActive) {
    await signOut({ redirect: false });
    redirect("/login");
  }

  const [subscription, enabledModules] = await Promise.all([
    requireSubscriptionAccess(
      membership.company.id,
      { allowExpired: options?.allowExpired },
    ),
    getEnabledModuleCodes(membership.company.id),
  ]);

  const companyExpired =
    membership.company.accessExpiresAt &&
    membership.company.accessExpiresAt.getTime() <= Date.now();

  if (
    membership.company.status !== "ACTIVE" ||
    companyExpired
  ) {
    redirect("/access-suspended");
  }

  return {
    user_id: membership.user.id,
    first_name: membership.user.firstName,
    last_name: membership.user.lastName,
    email: membership.user.email,
    company_id: membership.company.id,
    company_name: membership.company.name,
    role: membership.role,
    subscription,
    enabled_modules: Array.from(enabledModules),
    is_platform_admin: isPlatformAdminIdentity(membership.user),
    company_status: membership.company.status,
    company_access_expires_at: membership.company.accessExpiresAt,
  };
}
