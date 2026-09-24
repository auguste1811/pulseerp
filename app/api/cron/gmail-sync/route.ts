import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/integration-crypto";

function header(headers: any[], name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}
function mailbox(value: string) {
  const match = value.match(/^(.*?)<([^>]+)>$/);
  return {
    email: (match?.[2] || value).trim().replace(/^mailto:/i, "").toLowerCase(),
    name: match?.[1]?.trim().replace(/^"|"$/g, "") || null,
  };
}
function decode(value?: string) {
  try { return value ? Buffer.from(value, "base64url").toString("utf8") : ""; } catch { return ""; }
}
function textBody(part: any): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const child of part.parts || []) {
    const result = textBody(child);
    if (result) return result;
  }
  return "";
}
async function accessToken(connection: any) {
  let token = decryptSecret(connection.encrypted_access_token);
  if (token && (!connection.token_expires_at || new Date(connection.token_expires_at).getTime() >= Date.now() + 60000)) return token;
  const refresh = decryptSecret(connection.encrypted_refresh_token);
  if (!refresh) throw new Error("Refresh token Google absent.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  token = data.access_token;
  await query("UPDATE integration_connections SET encrypted_access_token=$2, token_expires_at=NOW()+($3 || ' seconds')::interval, updated_at=NOW() WHERE id=$1", [connection.id, encryptSecret(token), data.expires_in]);
  return token!;
}

async function syncConnection(connection: any) {
  if (!(connection.scopes || []).some((s: string) => s.includes("gmail.readonly"))) return 0;
  const token = await accessToken(connection);
  const after = connection.last_sync_at ? Math.floor(new Date(connection.last_sync_at).getTime()/1000)-120 : Math.floor((Date.now()-30*86400000)/1000);
  const params = new URLSearchParams({ q: `in:anywhere after:${Math.max(0, after)}`, maxResults: "100" });
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!listResponse.ok) throw new Error(await listResponse.text());
  const list = await listResponse.json();
  let imported = 0;
  for (const item of list.messages || []) {
    const exists = await query<any>("SELECT 1 FROM crm_emails WHERE company_id=$1 AND gmail_message_id=$2 LIMIT 1", [connection.company_id, item.id]);
    if (exists.length) continue;
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) continue;
    const message = await response.json();
    const headers = message.payload?.headers || [];
    const from = mailbox(header(headers, "From"));
    if (!from.email || from.email === String(connection.account_email || "").toLowerCase()) continue;
    const contacts = await query<any>("SELECT id FROM contacts WHERE company_id=$1 AND LOWER(email)=LOWER($2) LIMIT 1", [connection.company_id, from.email]);
    if (!contacts[0]) continue;
    const subject = header(headers, "Subject") || "(Sans objet)";
    const snippet = String(message.snippet || "").slice(0,5000) || null;
    const body = textBody(message.payload).slice(0,50000) || null;
    const received = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
    await query(`INSERT INTO crm_emails (id,company_id,contact_id,imported_by_id,gmail_message_id,gmail_thread_id,from_email,from_name,to_email,subject,snippet,body_text,received_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (company_id,gmail_message_id) DO NOTHING`, [randomUUID(),connection.company_id,contacts[0].id,connection.user_id,item.id,message.threadId||null,from.email,from.name,mailbox(header(headers,"To")).email||null,subject,snippet,body,received]);
    await query(`INSERT INTO contact_activities (id,company_id,contact_id,actor_id,type,title,description,created_at) VALUES ($1,$2,$3,$4,'EMAIL',$5,$6,$7)`, [randomUUID(),connection.company_id,contacts[0].id,connection.user_id,subject,snippet||"Email reçu depuis Gmail",received]);
    imported++;
  }
  await query("UPDATE integration_connections SET last_sync_at=NOW(),last_sync_status='SUCCESS',last_error=NULL,updated_at=NOW() WHERE id=$1",[connection.id]);
  return imported;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connections = await query<any>("SELECT * FROM integration_connections WHERE provider='GOOGLE' AND status='CONNECTED'");
  let imported = 0;
  let errors = 0;
  for (const connection of connections) {
    try { imported += await syncConnection(connection); }
    catch (error) {
      errors++;
      const message = error instanceof Error ? error.message : "Erreur Gmail";
      await query("UPDATE integration_connections SET last_sync_at=NOW(),last_sync_status='ERROR',last_error=$2,updated_at=NOW() WHERE id=$1",[connection.id,message.slice(0,1000)]);
    }
  }
  return NextResponse.json({ ok: errors === 0, connections: connections.length, imported, errors });
}
