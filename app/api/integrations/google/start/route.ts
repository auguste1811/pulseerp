import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { createIntegrationState } from "@/lib/integration-oauth";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_INTEGRATION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL("/integrations?error=google_config", request.url),
    );
  }

  const state = await createIntegrationState(
    session.companyId,
    session.userId,
    "GOOGLE",
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar",
    ].join(" "),
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
