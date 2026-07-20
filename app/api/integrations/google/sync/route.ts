import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/integration-crypto";

async function refreshGoogleToken(connection: any) {
  const refreshToken = decryptSecret(connection.encrypted_refresh_token);
  if (!refreshToken) throw new Error("Refresh token Google absent.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();

  await query(
    `
    UPDATE integration_connections
    SET encrypted_access_token=$2,
        token_expires_at=NOW() + ($3 || ' seconds')::interval,
        updated_at=NOW()
    WHERE id=$1
    `,
    [connection.id, encryptSecret(data.access_token), data.expires_in],
  );

  return data.access_token as string;
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await query<any>(
    `
    SELECT *
    FROM integration_connections
    WHERE company_id=$1 AND provider='GOOGLE' AND status='CONNECTED'
    LIMIT 1
    `,
    [session.companyId],
  );
  const connection = rows[0];
  if (!connection) return NextResponse.json({ error: "Google non connecté" }, { status: 404 });

  try {
    let token = decryptSecret(connection.encrypted_access_token);
    if (
      !token ||
      (connection.token_expires_at &&
        new Date(connection.token_expires_at).getTime() < Date.now() + 60000)
    ) {
      token = await refreshGoogleToken(connection);
    }

    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6);

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    let imported = 0;

    for (const event of payload.items || []) {
      if (!event.id || !event.summary || event.status === "cancelled") continue;
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      if (!start || !end) continue;

      await query(
        `
        INSERT INTO calendar_events (
          id, company_id, assigned_user_id, title, description,
          event_type, status, start_at, end_at, location,
          reminder_minutes, created_by, external_provider,
          external_id, external_url, external_updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,'MEETING','PLANNED',$6,$7,$8,
          30,$3,'GOOGLE',$9,$10,$11
        )
        ON CONFLICT (company_id, external_provider, external_id)
        DO UPDATE SET
          title=EXCLUDED.title,
          description=EXCLUDED.description,
          start_at=EXCLUDED.start_at,
          end_at=EXCLUDED.end_at,
          location=EXCLUDED.location,
          external_url=EXCLUDED.external_url,
          external_updated_at=EXCLUDED.external_updated_at,
          updated_at=NOW()
        `,
        [
          randomUUID(),
          session.companyId,
          session.userId,
          event.summary,
          event.description || null,
          new Date(start).toISOString(),
          new Date(end).toISOString(),
          event.location || null,
          event.id,
          event.htmlLink || null,
          event.updated || null,
        ],
      );
      imported += 1;
    }

    await query(
      `
      UPDATE integration_connections
      SET last_sync_at=NOW(), last_sync_status='SUCCESS',
          last_error=NULL, updated_at=NOW()
      WHERE id=$1
      `,
      [connection.id],
    );

    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Google";
    await query(
      `
      UPDATE integration_connections
      SET last_sync_at=NOW(), last_sync_status='ERROR',
          last_error=$2, updated_at=NOW()
      WHERE id=$1
      `,
      [connection.id, message.slice(0, 1000)],
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
