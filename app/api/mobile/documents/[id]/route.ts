import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mobileContext } from "@/lib/mobile-auth";
import { ensureCompanySubscription } from "@/lib/subscription";
import { query } from "@/lib/db";
import { tryBuildPublicInvoiceUrl, tryBuildPublicQuoteSignUrl } from "@/lib/invoice-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guarded(request: Request) {
  const ctx = await mobileContext(request);
  if (!ctx) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const access = await ensureCompanySubscription(ctx.company_id);
  if (!access.hasAccess) {
    return { error: NextResponse.json({ error: "Abonnement requis", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 }) };
  }
  return { ctx };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, ctx } = await guarded(request);
  if (error || !ctx) return error as Response;
  const { id } = await params;

  const [documents, items, payments] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name, c.email, c.phone
      FROM sales_documents d
      LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.id = $1 AND d.company_id = $2
      LIMIT 1
      `,
      [id, ctx.company_id],
    ),
    query<any>(
      `SELECT description, quantity, unit_price, vat_rate, line_total
       FROM sales_document_items WHERE document_id = $1 ORDER BY position, id`,
      [id],
    ),
    query<any>(
      `SELECT id, amount, paid_at, method, notes FROM document_payments
       WHERE document_id = $1 AND company_id = $2 ORDER BY paid_at DESC`,
      [id, ctx.company_id],
    ),
  ]);

  const document = documents[0];
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const paid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);

  return NextResponse.json({
    id: document.id,
    type: document.document_type,
    number: document.document_number,
    status: document.status,
    issueDate: document.issue_date,
    dueDate: document.due_date,
    validUntil: document.valid_until,
    notes: document.notes,
    subtotal: Number(document.subtotal),
    vatAmount: Number(document.vat_amount),
    total: Number(document.total),
    paid,
    remaining: Math.max(0, Number(document.total) - paid),
    signedBy: document.signed_by,
    signedAt: document.signed_at,
    client: {
      name: document.company_name || `${document.first_name || ""} ${document.last_name || ""}`.trim() || "Client",
      email: document.email,
      phone: document.phone,
    },
    items: items.map((item: any) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      vatRate: Number(item.vat_rate),
      lineTotal: Number(item.line_total),
    })),
    payments: payments.map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paid_at,
      method: p.method,
      notes: p.notes,
    })),
    publicPdfUrl:
      document.document_type === "INVOICE"
        ? tryBuildPublicInvoiceUrl(document.id, ctx.company_id)
        : "",
    publicSignUrl:
      document.document_type === "QUOTE" && ["SENT", "ACCEPTED"].includes(document.status)
        ? tryBuildPublicQuoteSignUrl(document.id, ctx.company_id)
        : "",
  });
}

const paySchema = z.object({
  amount: z.coerce.number().positive().max(100000000).optional(),
  method: z.string().trim().max(60).optional(),
});

// Marquer payé (sans montant = solde total) ou enregistrer un acompte.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, ctx } = await guarded(request);
  if (error || !ctx) return error as Response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = paySchema.safeParse(body || {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const documents = await query<any>(
    `SELECT id, total, document_type, status FROM sales_documents
     WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [id, ctx.company_id],
  );
  const document = documents[0];
  if (!document || document.document_type !== "INVOICE") {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }
  if (["PAID", "CANCELLED", "DRAFT"].includes(document.status)) {
    return NextResponse.json({ error: "Facture non payable en l'état" }, { status: 400 });
  }

  const sums = await query<any>(
    `SELECT COALESCE(SUM(amount),0) AS paid FROM document_payments WHERE document_id = $1`,
    [id],
  );
  const alreadyPaid = Number(sums[0]?.paid || 0);
  const remaining = Math.max(0, Number(document.total) - alreadyPaid);
  const amount = parsed.data.amount ? Math.min(parsed.data.amount, remaining) : remaining;

  if (amount <= 0) {
    return NextResponse.json({ error: "Rien à régler" }, { status: 400 });
  }

  await query(
    `INSERT INTO document_payments (id, company_id, document_id, amount, paid_at, method)
     VALUES ($1,$2,$3,$4,CURRENT_DATE,$5)`,
    [randomUUID(), ctx.company_id, id, amount, parsed.data.method || null],
  );

  const newPaid = alreadyPaid + amount;
  let status = document.status;
  if (newPaid >= Number(document.total)) {
    status = "PAID";
    await query(`UPDATE sales_documents SET status = 'PAID', updated_at = NOW() WHERE id = $1`, [id]);
    const { syncInvoiceWithAccounting } = await import("@/lib/accounting-sync");
    await syncInvoiceWithAccounting(ctx.company_id, id);
  }

  return NextResponse.json({ paid: newPaid, remaining: Math.max(0, Number(document.total) - newPaid), status });
}
