import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { publicAppUrl, stripeClient } from "@/lib/stripe";
import {
  stripeConnection,
  type StripeConnectionSettings,
} from "@/lib/stripe-connect";

export async function GET() {
  const member = await currentContext();
  const connection = await stripeConnection(member.company_id);
  const settings = (connection?.settings || {}) as StripeConnectionSettings;

  if (!settings.accountId) {
    return NextResponse.redirect(`${publicAppUrl()}/integrations?error=stripe_account`);
  }

  const baseUrl = publicAppUrl();
  const link = await stripeClient().accountLinks.create({
    account: settings.accountId,
    refresh_url: `${baseUrl}/api/integrations/stripe/refresh`,
    return_url: `${baseUrl}/api/integrations/stripe/return`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url);
}
