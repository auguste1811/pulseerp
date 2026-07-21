import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const TRIAL_DURATION_DAYS = 3;

export const PLAN_CODES = ["STARTER", "PRO", "BUSINESS"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type SubscriptionAccess = {
  subscriptionId: string;
  plan: string;
  status: string;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  hasAccess: boolean;
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
};

function trialEndFromNow() {
  const date = new Date();
  date.setDate(date.getDate() + TRIAL_DURATION_DAYS);
  return date;
}

export async function ensureCompanySubscription(
  companyId: string,
): Promise<SubscriptionAccess> {
  let subscription = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        companyId,
        plan: "TRIAL",
        status: "TRIALING",
        trialEndsAt: trialEndFromNow(),
      },
    });
  }

  const now = new Date();
  const paidAccess =
    ["ACTIVE", "TRIALING_STRIPE"].includes(subscription.status) &&
    (!subscription.currentPeriodEnd ||
      subscription.currentPeriodEnd.getTime() > now.getTime());

  const localTrialActive =
    subscription.status === "TRIALING" &&
    subscription.trialEndsAt.getTime() > now.getTime();

  const hasAccess = paidAccess || localTrialActive;
  const millisecondsRemaining = Math.max(
    0,
    subscription.trialEndsAt.getTime() - now.getTime(),
  );
  const daysRemaining = Math.ceil(
    millisecondsRemaining / (24 * 60 * 60 * 1000),
  );

  if (
    subscription.status === "TRIALING" &&
    !localTrialActive
  ) {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "EXPIRED" },
    });
  }

  return {
    subscriptionId: subscription.id,
    plan: subscription.plan,
    status:
      subscription.status === "TRIALING" && !localTrialActive
        ? "EXPIRED"
        : subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    stripeCustomerId: subscription.stripeCustomerId,
    hasAccess,
    isTrial: subscription.status === "TRIALING" && localTrialActive,
    isExpired: !hasAccess,
    daysRemaining,
  };
}

export async function requireSubscriptionAccess(
  companyId: string,
  options?: { allowExpired?: boolean },
) {
  const access = await ensureCompanySubscription(companyId);

  if (!access.hasAccess && !options?.allowExpired) {
    redirect("/subscribe?reason=expired");
  }

  return access;
}

export function stripePriceForPlan(plan: PlanCode): string | null {
  const prices: Record<PlanCode, string | undefined> = {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    PRO: process.env.STRIPE_PRICE_PRO,
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
  };

  return prices[plan] || null;
}

export function planFromPriceId(priceId: string | null | undefined): PlanCode {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId && priceId === process.env.STRIPE_PRICE_BUSINESS) {
    return "BUSINESS";
  }
  return "STARTER";
}
