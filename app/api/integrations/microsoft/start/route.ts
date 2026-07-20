import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { createIntegrationState } from "@/lib/integration-oauth";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL("/integrations?error=microsoft_config", request.url),
    );
  }

  const state = await createIntegrationState(
    session.companyId,
    session.userId,
    "MICROSOFT",
  );

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
      "Mail.Send",
    ].join(" "),
    state,
  });

  return NextResponse.redirect(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`,
  );
}
