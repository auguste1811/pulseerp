import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { buildInvoicePdf, loadInvoiceEmailData } from "@/lib/invoice-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await currentContext();
  const { id } = await params;
  const invoice = await loadInvoiceEmailData(id, member.company_id);

  if (!invoice || invoice.documentType !== "INVOICE") {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const pdf = buildInvoicePdf(invoice);
  const filename = `facture-${invoice.documentNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
