import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const TRIAL_DURATION_DAYS = 30;
export const PLAN_CODES = ["STARTER", "PRO", "BUSINESS"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type PlanInfo = {
  code: PlanCode;
  name: string;
  priceHt: number;
  description: string;
  features: string[];
};

export const PLANS: PlanInfo[] = [
  {
    code: "STARTER",
    name: "Starter",
    priceHt: 19,
    description: "Pour les indépendants et petites structures.",
    features: ["CRM et pipeline", "Devis et factures", "Comptabilité de base", "1 entreprise, 2 utilisateurs"],
  },
  {
    code: "PRO",
    name: "Pro",
    priceHt: 39,
    description: "Pour les équipes en croissance.",
    features: ["Tout Starter", "Automatisations", "PulseAI", "5 utilisateurs, support prioritaire"],
  },
  {
    code: "BUSINESS",
    name: "Business",
    priceHt: 79,
    description: "Pour les structures exigeantes.",
    features: ["Tout Pro", "Utilisateurs illimités", "Multi-entreprises", "Accompagnement dédié"],
  },
];

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
  isPastDue: boolean;
  daysRemaining: number;
};

export function trialEndFromNow(): Date {
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
        plan: "TRIAL",
        status: "TRIALING",
        trialEndsAt: trialEndFromNow(),
      },
    });
  }

  const now = new Date();
  const isTrial = subscription.status === "TRIALING";
  const trialActive = isTrial && subscription.trialEndsAt.getTime() > now.getTime();
  const isExpired = isTrial && !trialActive;
  const isPastDue = subscription.status === "PAST_DUE";
  const hasAccess =
    trialActive ||
    subscription.status === "ACTIVE" ||
    subscription.status === "TRIALING_STRIPE";

  return {
    subscriptionId: subscription.id,
    plan: subscription.plan,
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    stripeCustomerId: subscription.stripeCustomerId,
    hasAccess,
    isTrial: isTrial && trialActive,
    isExpired,
    isPastDue,
    daysRemaining: trialActive
      ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
      : 0,
  };
}

export async function requireSubscriptionAccess(
  companyId: string,
  options?: { allowExpired?: boolean },
): Promise<SubscriptionAccess> {
  const access = await ensureCompanySubscription(companyId);
  if (!access.hasAccess && !options?.allowExpired) {
    redirect("/subscribe");
  }
  return access;
}

export function stripePriceForPlan(plan: PlanCode): string | null {
  const map: Record<PlanCode, string | undefined> = {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    PRO: process.env.STRIPE_PRICE_PRO,
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
  };
  return map[plan] || null;
}

export function planFromPriceId(priceId: string | null | undefined): PlanCode {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  return "STARTER";
}

export function planInfo(code: string | null | undefined): PlanInfo {
  return PLANS.find((p) => p.code === code) || PLANS[0];
}
