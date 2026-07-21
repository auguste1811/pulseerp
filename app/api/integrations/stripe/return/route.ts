import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { publicAppUrl } from "@/lib/stripe";
import { refreshStripeConnection } from "@/lib/stripe-connect";

export async function GET() {
  const member = await currentContext();
  const account = await refreshStripeConnection(
    member.company_id,
    member.user_id,
  );

  if (!account) {
    return NextResponse.redirect(`${publicAppUrl()}/integrations?error=stripe_return`);
  }

  const ready = Boolean(account.charges_enabled && account.payouts_enabled);
  return NextResponse.redirect(
    `${publicAppUrl()}/integrations?connected=stripe&ready=${ready ? "1" : "0"}`,
  );
}
