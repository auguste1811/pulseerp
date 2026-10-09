import { NextResponse } from "next/server";
import { mobileContext } from "@/lib/mobile-auth";
import { ensureCompanySubscription } from "@/lib/subscription";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await mobileContext(request);
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const access = await ensureCompanySubscription(ctx.company_id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Abonnement requis", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  const notifications = await query<any>(
    `SELECT id, title, message, type, is_read, created_at
     FROM notifications
     WHERE company_id = $1 AND (user_id IS NULL OR user_id = $2)
     ORDER BY created_at DESC
     LIMIT 50`,
    [ctx.company_id, ctx.user_id],
  );

  return NextResponse.json({
    notifications: notifications.map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const ctx = await mobileContext(request);
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;

  if (id) {
    await query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND company_id = $2 AND (user_id IS NULL OR user_id = $3)`,
      [id, ctx.company_id, ctx.user_id],
    );
  } else {
    await query(
      `UPDATE notifications SET is_read = true
       WHERE company_id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [ctx.company_id, ctx.user_id],
    );
  }

  return NextResponse.json({ ok: true });
}
