import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/integration-crypto";

function header(headers: Array<{ name?: string; value?: string }>, name: string) {
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function parseMailbox(value: string) {
  const match = value.match(/^(.*?)<([^>]+)>$/);
  const email = (match?.[2] || value).trim().replace(/^mailto:/i, "").toLowerCase();
  const name = match?.[1]?.trim().replace(/^"|"$/g, "") || null;
  return { email, name };
}

function decodeBase64Url(value?: string) {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function textBody(part: any): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts || []) {
    const found = textBody(child);
    if (found) return found;
  }
  return "";
}

async function refreshToken(connection: any) {
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
    `UPDATE integration_connections
     SET encrypted_access_token=$2,
         token_expires_at=NOW() + ($3 || ' seconds')::interval,
         updated_at=NOW()
     WHERE id=$1`,
    [connection.id, encryptSecret(data.access_token), data.expires_in],
  );
  return data.access_token as string;
}

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await query<any>(
    `SELECT * FROM integration_connections
     WHERE company_id=$1 AND provider='GOOGLE' AND status='CONNECTED' LIMIT 1`,
    [session.companyId],
  );
  const connection = rows[0];
  if (!connection) return NextResponse.json({ ok: true, skipped: "not_connected" });

  if (!(connection.scopes || []).some((scope: string) => scope.includes("gmail.readonly"))) {
    return NextResponse.json({ ok: true, skipped: "gmail_scope_missing" });
  }

  try {
    let token = decryptSecret(connection.encrypted_access_token);
    if (!token || (connection.token_expires_at && new Date(connection.token_expires_at).getTime() < Date.now() + 60000)) {
      token = await refreshToken(connection);
    }

    const after = connection.last_sync_at
      ? Math.max(0, Math.floor(new Date(connection.last_sync_at).getTime() / 1000) - 120)
      : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    const listParams = new URLSearchParams({
      q: `in:anywhere after:${after}`,
      maxResults: "100",
    });
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!listResponse.ok) throw new Error(await listResponse.text());
    const list = await listResponse.json();

    let imported = 0;
    for (const item of list.messages || []) {
      const existing = await query<any>(
        "SELECT id FROM crm_emails WHERE company_id=$1 AND gmail_message_id=$2 LIMIT 1",
        [session.companyId, item.id],
      );
      if (existing.length) continue;

      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (!messageResponse.ok) continue;
      const message = await messageResponse.json();
      const headers = message.payload?.headers || [];
      const from = parseMailbox(header(headers, "From"));
      if (!from.email || from.email === String(connection.account_email || "").toLowerCase()) continue;

      const contacts = await query<any>(
        "SELECT id FROM contacts WHERE company_id=$1 AND LOWER(email)=LOWER($2) LIMIT 1",
        [session.companyId, from.email],
      );
      const contact = contacts[0];
      if (!contact) continue;

      const subject = header(headers, "Subject") || "(Sans objet)";
      const to = parseMailbox(header(headers, "To")).email || null;
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString();
      const body = textBody(message.payload).slice(0, 50000) || null;
      const snippet = String(message.snippet || "").slice(0, 5000) || null;

      await query(
        `INSERT INTO crm_emails (
          id, company_id, contact_id, imported_by_id, gmail_message_id,
          gmail_thread_id, from_email, from_name, to_email, subject,
          snippet, body_text, received_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (company_id, gmail_message_id) DO NOTHING`,
        [
          randomUUID(), session.companyId, contact.id, session.userId, item.id,
          message.threadId || null, from.email, from.name, to, subject,
          snippet, body, receivedAt,
        ],
      );

      await query(
        `INSERT INTO contact_activities
          (id, company_id, contact_id, actor_id, type, title, description, created_at)
         VALUES ($1,$2,$3,$4,'EMAIL',$5,$6,$7)`,
        [
          randomUUID(), session.companyId, contact.id, session.userId,
          subject, snippet || "Email reçu depuis Gmail", receivedAt,
        ],
      );
      imported += 1;
    }

    await query(
      `UPDATE integration_connections
       SET last_sync_at=NOW(), last_sync_status='SUCCESS', last_error=NULL, updated_at=NOW()
       WHERE id=$1`,
      [connection.id],
    );

    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Gmail";
    await query(
      `UPDATE integration_connections
       SET last_sync_at=NOW(), last_sync_status='ERROR', last_error=$2, updated_at=NOW()
       WHERE id=$1`,
      [connection.id, message.slice(0, 1000)],
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
