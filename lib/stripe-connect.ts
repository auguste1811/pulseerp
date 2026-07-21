import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export type StripeConnectionSettings = {
  accountId?: string;
  country?: string | null;
  defaultCurrency?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirementsCurrentlyDue?: string[];
};

export async function stripeConnection(companyId: string) {
  const rows = await query<any>(
    `
    SELECT *
    FROM integration_connections
    WHERE company_id=$1 AND provider='STRIPE'
    LIMIT 1
    `,
    [companyId],
  );
  return rows[0] || null;
}

export async function saveStripeAccount(input: {
  companyId: string;
  userId: string;
  account: any;
}) {
  const account = input.account;
  const settings: StripeConnectionSettings = {
    accountId: account.id,
    country: account.country || null,
    defaultCurrency: account.default_currency || null,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsCurrentlyDue: account.requirements?.currently_due || [],
  };

  const status =
    settings.chargesEnabled && settings.payoutsEnabled
      ? "CONNECTED"
      : "ONBOARDING";

  await query(
    `
    INSERT INTO integration_connections (
      id, company_id, user_id, provider, account_email, account_name,
      status, settings, last_sync_at, last_sync_status,
      created_at, updated_at
    )
    VALUES ($1,$2,$3,'STRIPE',$4,$5,$6,$7::jsonb,NOW(),'SUCCESS',NOW(),NOW())
    ON CONFLICT (company_id, provider)
    DO UPDATE SET
      user_id=EXCLUDED.user_id,
      account_email=EXCLUDED.account_email,
      account_name=EXCLUDED.account_name,
      status=EXCLUDED.status,
      settings=EXCLUDED.settings,
      last_sync_at=NOW(),
      last_sync_status='SUCCESS',
      last_error=NULL,
      updated_at=NOW()
    `,
    [
      randomUUID(),
      input.companyId,
      input.userId,
      account.email || null,
      account.business_profile?.name ||
        account.settings?.dashboard?.display_name ||
        account.id,
      status,
      JSON.stringify(settings),
    ],
  );

  return settings;
}

export async function refreshStripeConnection(companyId: string, userId: string) {
  const connection = await stripeConnection(companyId);
  const settings = (connection?.settings || {}) as StripeConnectionSettings;
  if (!settings.accountId) return null;

  const account = await stripeClient().accounts.retrieve(settings.accountId);
  if ((account as any).deleted) return null;
  await saveStripeAccount({ companyId, userId, account });
  return account;
}
