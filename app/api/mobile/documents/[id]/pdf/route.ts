import { NextResponse } from "next/server";
import { mobileContext } from "@/lib/mobile-auth";
import { ensureCompanySubscription } from "@/lib/subscription";
import { query } from "@/lib/db";
import { buildInvoicePdf, loadInvoiceEmailData } from "@/lib/invoice-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await mobileContext(request);
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const access = await ensureCompanySubscription(ctx.company_id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Abonnement requis", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  const { id } = await params;
  const documents = await query<{ company_id: string }>(
    `SELECT company_id FROM sales_documents WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [id, ctx.company_id],
  );
  if (!documents[0]) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const invoice = await loadInvoiceEmailData(id, ctx.company_id);
  if (!invoice) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const pdf = buildInvoicePdf(invoice);
  const prefix = invoice.documentType === "QUOTE" ? "devis" : invoice.documentType === "CREDIT_NOTE" ? "avoir" : "facture";
  const filename = `${prefix}-${invoice.documentNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
