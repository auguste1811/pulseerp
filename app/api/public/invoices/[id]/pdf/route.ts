import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildInvoicePdf, loadInvoiceEmailData } from "@/lib/invoice-email";
import { verifyInvoiceShareToken } from "@/lib/invoice-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";

  const documents = await query<{
    company_id: string;
    document_type: string;
  }>(
    `
    SELECT company_id, document_type
    FROM sales_documents
    WHERE id=$1
    LIMIT 1
    `,
    [id],
  );

  const document = documents[0];

  if (
    !document ||
    document.document_type !== "INVOICE" ||
    !token ||
    !verifyInvoiceShareToken(token, id, document.company_id)
  ) {
    return NextResponse.json(
      { error: "Lien de facture invalide ou expiré." },
      { status: 404 },
    );
  }

  const invoice = await loadInvoiceEmailData(id, document.company_id);
  if (!invoice) {
    return NextResponse.json(
      { error: "Facture introuvable." },
      { status: 404 },
    );
  }

  const pdf = buildInvoicePdf(invoice);
  const filename = `facture-${invoice.documentNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
