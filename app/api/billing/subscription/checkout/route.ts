import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PLAN_CODES,
  stripePriceForPlan,
  type PlanCode,
} from "@/lib/subscription";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const member = await currentContext({ allowExpired: true });

  if (!["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json(
      { error: "Seul un administrateur peut gérer l’abonnement." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const plan = String(formData.get("plan") || "") as PlanCode;

  if (!PLAN_CODES.includes(plan)) {
    return NextResponse.json({ error: "Offre invalide" }, { status: 400 });
  }

  const priceId = stripePriceForPlan(plan);

  if (!priceId) {
    return NextResponse.json(
      { error: `Le tarif Stripe ${plan} n’est pas configuré.` },
      { status: 500 },
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { companyId: member.company_id },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "Abonnement introuvable" },
      { status: 404 },
    );
  }

  const stripe = stripeClient();
  let customerId = subscription.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: member.email,
      name: member.company_name,
      metadata: {
        pulseerpCompanyId: member.company_id,
      },
    });

    customerId = customer.id;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  const baseUrl =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/subscribe?success=1`,
    cancel_url: `${baseUrl}/subscribe?canceled=1`,
    client_reference_id: member.company_id,
    metadata: {
      pulseerpCompanyId: member.company_id,
      pulseerpPlan: plan,
    },
    subscription_data: {
      metadata: {
        pulseerpCompanyId: member.company_id,
        pulseerpPlan: plan,
      },
    },
  });

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Stripe n’a pas retourné de page de paiement." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(checkout.url, 303);
}
