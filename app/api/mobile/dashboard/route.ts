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

  const [kpis, recent, unread] = await Promise.all([
    query<any>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN document_type = 'INVOICE' AND status = 'PAID' THEN total ELSE 0 END),0) AS encaisse,
        COALESCE(SUM(CASE WHEN document_type = 'INVOICE' AND status IN ('SENT','OVERDUE') THEN total ELSE 0 END),0) AS impayes,
        COALESCE(SUM(CASE WHEN document_type = 'INVOICE' AND status IN ('SENT','OVERDUE') THEN 1 ELSE 0 END),0) AS factures_en_attente,
        COALESCE(SUM(CASE WHEN document_type = 'QUOTE' AND status = 'SENT' THEN 1 ELSE 0 END),0) AS devis_en_cours,
        COALESCE(SUM(CASE WHEN document_type = 'QUOTE' AND status = 'SENT' THEN total ELSE 0 END),0) AS devis_montant
      FROM sales_documents
      WHERE company_id = $1
      `,
      [ctx.company_id],
    ),
    query<any>(
      `
      SELECT d.id, d.document_type, d.document_number, d.status, d.total, d.issue_date,
             COALESCE(c.company_name, CONCAT(c.first_name,' ',c.last_name), 'Client') AS client
      FROM sales_documents d
      LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.company_id = $1
      ORDER BY d.created_at DESC
      LIMIT 5
      `,
      [ctx.company_id],
    ),
    query<any>(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE company_id = $1 AND (user_id IS NULL OR user_id = $2) AND is_read = false`,
      [ctx.company_id, ctx.user_id],
    ),
  ]);

  return NextResponse.json({
    company: { id: ctx.company_id, name: ctx.company_name },
    trial: access.isTrial ? { daysRemaining: access.daysRemaining } : null,
    kpis: {
      encaisse: Number(kpis[0]?.encaisse || 0),
      impayes: Number(kpis[0]?.impayes || 0),
      facturesEnAttente: Number(kpis[0]?.factures_en_attente || 0),
      devisEnCours: Number(kpis[0]?.devis_en_cours || 0),
      devisMontant: Number(kpis[0]?.devis_montant || 0),
    },
    recent: recent.map((d: any) => ({
      id: d.id,
      type: d.document_type,
      number: d.document_number,
      status: d.status,
      total: Number(d.total),
      client: d.client,
      issueDate: d.issue_date,
    })),
    unreadNotifications: unread[0]?.count || 0,
  });
}
