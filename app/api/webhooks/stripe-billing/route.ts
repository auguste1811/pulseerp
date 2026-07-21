import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { planFromPriceId } from "@/lib/subscription";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

type StripeSubscriptionCompat = Stripe.Subscription & {
  current_period_end?: number;
  cancel_at_period_end?: boolean;
};

function statusForStripe(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING_STRIPE";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "PAST_DUE";
    case "paused":
      return "PAUSED";
    case "canceled":
      return "CANCELED";
    default:
      return "PAST_DUE";
  }
}

function asDate(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000) : null;
}

async function companyIdFromCustomer(
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;

  const stored = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { companyId: true },
  });

  if (stored) return stored.companyId;

  const customer = await stripeClient().customers.retrieve(customerId);

  if (!customer.deleted) {
    return customer.metadata.pulseerpCompanyId || null;
  }

  return null;
}

async function syncSubscription(
  stripeSubscription: StripeSubscriptionCompat,
  preferredCompanyId?: string | null,
) {
  const customerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;

  const companyId =
    preferredCompanyId ||
    stripeSubscription.metadata.pulseerpCompanyId ||
    (await companyIdFromCustomer(customerId));

  if (!companyId) return;

  const firstItem = stripeSubscription.items.data[0];
  const priceId = firstItem?.price?.id || null;
  const plan =
    stripeSubscription.metadata.pulseerpPlan ||
    planFromPriceId(priceId);

  await prisma.subscription.upsert({
    where: { companyId },
    update: {
      plan,
      status: statusForStripe(stripeSubscription.status),
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: asDate(stripeSubscription.current_period_end),
      cancelAtPeriodEnd:
        stripeSubscription.cancel_at_period_end || false,
    },
    create: {
      companyId,
      plan,
      status: statusForStripe(stripeSubscription.status),
      trialEndsAt: new Date(),
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: asDate(stripeSubscription.current_period_end),
      cancelAtPeriodEnd:
        stripeSubscription.cancel_at_period_end || false,
    },
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!secret || !signature) {
    return NextResponse.json(
      { error: "Webhook Stripe Billing non configuré" },
      { status: 400 },
    );
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripeClient().webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
  } catch (error) {
    console.error("Signature Stripe Billing invalide", error);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId =
        session.metadata?.pulseerpCompanyId ||
        session.client_reference_id ||
        null;

      if (typeof session.subscription === "string") {
        const subscription = (await stripeClient().subscriptions.retrieve(
          session.subscription,
        )) as StripeSubscriptionCompat;

        await syncSubscription(subscription, companyId);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(
        event.data.object as StripeSubscriptionCompat,
      );
    }

    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id || null;
      const companyId = await companyIdFromCustomer(customerId);

      if (companyId) {
        await prisma.subscription.updateMany({
          where: { companyId },
          data: {
            status:
              event.type === "invoice.paid"
                ? "ACTIVE"
                : "PAST_DUE",
          },
        });
      }
    }
  } catch (error) {
    console.error("Traitement Stripe Billing impossible", error);
    return NextResponse.json(
      { error: "Traitement impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
