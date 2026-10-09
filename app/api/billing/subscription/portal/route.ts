import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicAppUrl, stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portail client Stripe : mettre à jour la carte, retenter un paiement,
// voir les factures, résilier. Utilisé après un échec de paiement.
export async function POST(request: Request) {
  const member = await currentContext({ allowExpired: true });
  const subscription = await prisma.subscription.findUnique({
    where: { companyId: member.company_id },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.redirect(new URL("/subscribe", request.url), 303);
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${publicAppUrl()}/billing`,
  });

  return NextResponse.redirect(session.url, 303);
}
