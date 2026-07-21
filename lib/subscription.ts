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

export async function ensureCompanySubscription(companyId: string): Promise<SubscriptionAccess> {
  let subscription = await prisma.subscription.findUnique({ where: { companyId } });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        companyId,
        plan: "FREE_PREVIEW",
        status: "ACTIVE",
        trialEndsAt: trialEndFromNow(),
      },
    });
  }

  // Stripe Billing est volontairement désactivé dans cette version.
  // L’accès à PulseERP reste ouvert, même si un ancien essai a expiré.
  return {
    subscriptionId: subscription.id,
    plan: subscription.plan === "TRIAL" ? "FREE_PREVIEW" : subscription.plan,
    status: "ACTIVE",
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    stripeCustomerId: subscription.stripeCustomerId,
    hasAccess: true,
    isTrial: false,
    isExpired: false,
    daysRemaining: 0,
  };
}

export async function requireSubscriptionAccess(
  companyId: string,
  _options?: { allowExpired?: boolean },
) {
  return ensureCompanySubscription(companyId);
}

export function stripePriceForPlan(_plan: PlanCode): string | null {
  return null;
}

export function planFromPriceId(_priceId: string | null | undefined): PlanCode {
  return "STARTER";
}
