import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { refreshStripeConnection } from "@/lib/stripe-connect";

export async function POST() {
  const member = await currentContext();
  const account = await refreshStripeConnection(
    member.company_id,
    member.user_id,
  );

  if (!account) {
    return NextResponse.json({ error: "Compte Stripe introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
}
