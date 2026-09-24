import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const base = new URL(request.url);
  const syncUrl = new URL("/api/integrations/google/gmail-sync", base);

  try {
    const cookie = request.headers.get("cookie") || "";
    await fetch(syncUrl, {
      method: "POST",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
  } catch {
    // Google remains connected even if the first CRM import fails.
  }

  return NextResponse.redirect(new URL("/integrations?connected=google", base));
}
