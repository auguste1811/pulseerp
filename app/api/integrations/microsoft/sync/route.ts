import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await query<any>(
    `
    SELECT *
    FROM integration_connections
    WHERE company_id=$1 AND provider='MICROSOFT' AND status='CONNECTED'
    LIMIT 1
    `,
    [session.companyId],
  );
  const connection = rows[0];
  if (!connection) return NextResponse.json({ error: "Microsoft non connecté" }, { status: 404 });

  try {
    const token = decryptSecret(connection.encrypted_access_token);
    if (!token) throw new Error("Token Microsoft absent.");

    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 6);

    const params = new URLSearchParams({
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      $top: "250",
      $orderby: "start/dateTime",
    });

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      },
    );
    if (!response.ok) throw new Error(await response.text());

    const payload = await response.json();
    let imported = 0;

    for (const event of payload.value || []) {
      if (!event.id || !event.subject || event.isCancelled) continue;

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
          30,$3,'MICROSOFT',$9,$10,$11
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
          event.subject,
          event.bodyPreview || null,
          new Date(event.start.dateTime + "Z").toISOString(),
          new Date(event.end.dateTime + "Z").toISOString(),
          event.location?.displayName || null,
          event.id,
          event.webLink || null,
          event.lastModifiedDateTime || null,
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
    const message = error instanceof Error ? error.message : "Erreur Microsoft";
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
