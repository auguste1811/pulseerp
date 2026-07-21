import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { publicAppUrl, stripeClient } from "@/lib/stripe";
import {
  saveStripeAccount,
  stripeConnection,
  type StripeConnectionSettings,
} from "@/lib/stripe-connect";

export async function POST() {
  const member = await currentContext();
  const stripe = stripeClient();
  const existing = await stripeConnection(member.company_id);
  const currentSettings = (existing?.settings || {}) as StripeConnectionSettings;

  let accountId = currentSettings.accountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      country: process.env.STRIPE_CONNECT_COUNTRY || "FR",
      email: member.email,
      metadata: {
        pulseerpCompanyId: member.company_id,
      },
      business_profile: {
        name: member.company_name,
      },
    });

    accountId = account.id;
    await saveStripeAccount({
      companyId: member.company_id,
      userId: member.user_id,
      account,
    });
  }

  const baseUrl = publicAppUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/api/integrations/stripe/refresh`,
    return_url: `${baseUrl}/api/integrations/stripe/return`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url, 303);
}
