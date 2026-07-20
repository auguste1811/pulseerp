import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { encryptSecret } from "@/lib/integration-crypto";

export type Provider =
  | "GOOGLE"
  | "MICROSOFT"
  | "STRIPE"
  | "BRIDGE"
  | "GOOGLE_DRIVE"
  | "SLACK";

export async function saveOAuthConnection(input: {
  companyId: string;
  userId: string;
  provider: Provider;
  accountEmail?: string | null;
  accountName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes?: string[];
  settings?: Record<string, unknown>;
}) {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000)
    : null;

  await query(
    `
    INSERT INTO integration_connections (
      id, company_id, user_id, provider, account_email, account_name,
      encrypted_access_token, encrypted_refresh_token, token_expires_at,
      scopes, status, settings, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CONNECTED',$11,NOW())
    ON CONFLICT (company_id, provider)
    DO UPDATE SET
      user_id=EXCLUDED.user_id,
      account_email=EXCLUDED.account_email,
      account_name=EXCLUDED.account_name,
      encrypted_access_token=EXCLUDED.encrypted_access_token,
      encrypted_refresh_token=COALESCE(
        EXCLUDED.encrypted_refresh_token,
        integration_connections.encrypted_refresh_token
      ),
      token_expires_at=EXCLUDED.token_expires_at,
      scopes=EXCLUDED.scopes,
      status='CONNECTED',
      settings=EXCLUDED.settings,
      last_error=NULL,
      updated_at=NOW()
    `,
    [
      randomUUID(),
      input.companyId,
      input.userId,
      input.provider,
      input.accountEmail || null,
      input.accountName || null,
      encryptSecret(input.accessToken),
      encryptSecret(input.refreshToken),
      expiresAt?.toISOString() || null,
      input.scopes || [],
      JSON.stringify(input.settings || {}),
    ],
  );
}

export async function saveApiKeyConnection(input: {
  companyId: string;
  userId: string;
  provider: Provider;
  accountName?: string | null;
  apiKey: string;
  settings?: Record<string, unknown>;
}) {
  await saveOAuthConnection({
    companyId: input.companyId,
    userId: input.userId,
    provider: input.provider,
    accountName: input.accountName,
    accessToken: input.apiKey,
    settings: input.settings,
  });
}
