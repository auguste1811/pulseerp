"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { saveApiKeyConnection } from "@/lib/integrations";

export async function connectStripe(formData: FormData) {
  const member = await currentContext();
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (!apiKey.startsWith("sk_")) {
    redirect("/integrations?error=stripe_key");
  }

  const response = await fetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    redirect("/integrations?error=stripe_auth");
  }

  const account = await response.json();

  await saveApiKeyConnection({
    companyId: member.company_id,
    userId: member.user_id,
    provider: "STRIPE",
    accountName:
      account.business_profile?.name ||
      account.settings?.dashboard?.display_name ||
      account.id,
    apiKey,
    settings: {
      accountId: account.id,
      country: account.country,
      defaultCurrency: account.default_currency,
    },
  });

  revalidatePath("/integrations");
  redirect("/integrations?connected=stripe");
}

export async function connectBridge(formData: FormData) {
  const member = await currentContext();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();

  if (!clientId || !clientSecret) {
    redirect("/integrations?error=bridge_config");
  }

  await saveApiKeyConnection({
    companyId: member.company_id,
    userId: member.user_id,
    provider: "BRIDGE",
    accountName: "Bridge Banking",
    apiKey: clientSecret,
    settings: { clientId },
  });

  revalidatePath("/integrations");
  redirect("/integrations?connected=bridge");
}

export async function disconnectIntegration(formData: FormData) {
  const member = await currentContext();
  const provider = String(formData.get("provider") ?? "");

  await query(
    `
    DELETE FROM integration_connections
    WHERE company_id=$1 AND provider=$2
    `,
    [member.company_id, provider],
  );

  revalidatePath("/integrations");
  redirect("/integrations?disconnected=1");
}
