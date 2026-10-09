import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { stripePriceForPlan, type PlanCode } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { publicAppUrl, stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PLANS: PlanCode[] = ["STARTER", "PRO", "BUSINESS"];

export async function POST(request: Request) {
  const member = await currentContext({ allowExpired: true });
  const formData = await request.formData().catch(() => null);
  const plan = String(formData?.get("plan") || "") as PlanCode;

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.redirect(new URL("/subscribe?error=plan", request.url), 303);
  }

  const priceId = stripePriceForPlan(plan);
  if (!priceId) {
    return NextResponse.redirect(new URL("/subscribe?error=config", request.url), 303);
  }

  const stripe = stripeClient();
  const appUrl = publicAppUrl();

  const subscription = await prisma.subscription.findUnique({
    where: { companyId: member.company_id },
  });

  let customerId = subscription?.stripeCustomerId || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: member.email,
      name: member.company_name,
      metadata: { pulseerpCompanyId: member.company_id },
    });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { companyId: member.company_id },
      update: { stripeCustomerId: customerId },
      create: {
        companyId: member.company_id,
        plan: "TRIAL",
        status: "TRIALING",
        trialEndsAt: new Date(),
        stripeCustomerId: customerId,
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: member.company_id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { pulseerpCompanyId: member.company_id, pulseerpPlan: plan },
    subscription_data: { metadata: { pulseerpCompanyId: member.company_id, pulseerpPlan: plan } },
    success_url: `${appUrl}/billing?subscribed=1`,
    cancel_url: `${appUrl}/subscribe?canceled=1`,
  });

  if (!session.url) {
    return NextResponse.redirect(new URL("/subscribe?error=stripe", request.url), 303);
  }
  return NextResponse.redirect(session.url, 303);
}
