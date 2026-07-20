import { NextResponse } from "next/server";
import { verifyIntegrationState } from "@/lib/integration-oauth";
import { saveOAuthConnection } from "@/lib/integrations";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=google_callback", request.url),
    );
  }

  try {
    const verified = await verifyIntegrationState(state, "GOOGLE");
    const redirectUri = process.env.GOOGLE_INTEGRATION_REDIRECT_URI!;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }

    const tokens = await tokenResponse.json();
    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    const profile = await profileResponse.json();

    await saveOAuthConnection({
      companyId: verified.companyId,
      userId: verified.userId,
      provider: "GOOGLE",
      accountEmail: profile.email,
      accountName: profile.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scopes: String(tokens.scope || "").split(" ").filter(Boolean),
    });

    return NextResponse.redirect(
      new URL("/integrations?connected=google", request.url),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(
      new URL("/integrations?error=google_oauth", request.url),
    );
  }
}
