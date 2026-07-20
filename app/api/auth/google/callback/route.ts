import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  consumeGoogleState,
  createSession,
  verifyGoogleIdToken,
} from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!code || !(await consumeGoogleState(state))) {
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) throw new Error("Échange OAuth refusé.");

    const tokenData = (await tokenResponse.json()) as { id_token?: string };
    if (!tokenData.id_token) throw new Error("ID token Google absent.");

    const profile = await verifyGoogleIdToken(tokenData.id_token);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query<{
        id: string;
        email: string;
        company_id: string | null;
      }>(
        `
        SELECT u.id, u.email, cm.company_id
        FROM users u
        LEFT JOIN company_members cm ON cm.user_id = u.id
        WHERE u.email = $1
        ORDER BY cm.role = 'OWNER' DESC
        LIMIT 1
        `,
        [profile.email],
      );

      let userId = existing.rows[0]?.id;
      let companyId = existing.rows[0]?.company_id;

      if (!userId) {
        userId = randomUUID();
        companyId = randomUUID();

        await client.query(
          `
          INSERT INTO users (
            id, first_name, last_name, email, password_hash,
            google_id, is_active, email_verified_at
          )
          VALUES ($1, $2, $3, $4, '', $5, TRUE, NOW())
          `,
          [
            userId,
            profile.firstName,
            profile.lastName,
            profile.email,
            profile.googleId,
          ],
        );

        await client.query(
          `
          INSERT INTO companies (id, name, currency, default_vat_rate)
          VALUES ($1, $2, 'EUR', 20)
          `,
          [companyId, `Entreprise de ${profile.firstName}`],
        );

        await client.query(
          `
          INSERT INTO company_members (user_id, company_id, role)
          VALUES ($1, $2, 'OWNER')
          `,
          [userId, companyId],
        );
      } else {
        await client.query(
          `
          UPDATE users
          SET google_id = COALESCE(google_id, $2),
              email_verified_at = COALESCE(email_verified_at, NOW()),
              last_login_at = NOW()
          WHERE id = $1
          `,
          [userId, profile.googleId],
        );
      }

      await client.query("COMMIT");

      await createSession({
        userId,
        companyId: companyId!,
        email: profile.email,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }
}
