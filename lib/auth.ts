import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionAccess } from "@/lib/subscription";

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

  const subscription = await requireSubscriptionAccess(
    membership.company.id,
    { allowExpired: options?.allowExpired },
  );

  return {
    user_id: membership.user.id,
    first_name: membership.user.firstName,
    last_name: membership.user.lastName,
    email: membership.user.email,
    company_id: membership.company.id,
    company_name: membership.company.name,
    role: membership.role,
    subscription,
  };
}
