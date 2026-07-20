import { NextResponse } from "next/server";
import { verifyIntegrationState } from "@/lib/integration-oauth";
import { saveOAuthConnection } from "@/lib/integrations";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=microsoft_callback", request.url),
    );
  }

  try {
    const verified = await verifyIntegrationState(state, "MICROSOFT");
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
          grant_type: "authorization_code",
          scope: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "User.Read",
            "Calendars.ReadWrite",
            "Mail.Send",
          ].join(" "),
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }

    const tokens = await tokenResponse.json();
    const profileResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const profile = await profileResponse.json();

    await saveOAuthConnection({
      companyId: verified.companyId,
      userId: verified.userId,
      provider: "MICROSOFT",
      accountEmail: profile.mail || profile.userPrincipalName,
      accountName: profile.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scopes: String(tokens.scope || "").split(" ").filter(Boolean),
    });

    return NextResponse.redirect(
      new URL("/integrations?connected=microsoft", request.url),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(
      new URL("/integrations?error=microsoft_oauth", request.url),
    );
  }
}
