import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyInvoiceShareToken } from "@/lib/invoice-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  const token = String(formData?.get("token") || "");
  const signerName = String(formData?.get("signerName") || "").trim().slice(0, 160);

  const documents = await query<{
    company_id: string;
    document_type: string;
    status: string;
  }>(
    `
    SELECT company_id, document_type, status
    FROM sales_documents
    WHERE id=$1
    LIMIT 1
    `,
    [id],
  );

  const document = documents[0];
  const backUrl = `/quotes/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;

  if (
    !document ||
    document.document_type !== "QUOTE" ||
    !token ||
    !verifyInvoiceShareToken(token, id, document.company_id)
  ) {
    return NextResponse.json(
      { error: "Lien de devis invalide ou expiré." },
      { status: 404 },
    );
  }

  if (document.status === "ACCEPTED") {
    return NextResponse.redirect(new URL(`${backUrl}&signed=1`, request.url), 303);
  }

  if (document.status !== "SENT" || !signerName) {
    return NextResponse.redirect(new URL(`${backUrl}&error=1`, request.url), 303);
  }

  await query(
    `
    UPDATE sales_documents
    SET status = 'ACCEPTED', signed_at = NOW(), signed_by = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [id, signerName],
  );

  return NextResponse.redirect(new URL(`${backUrl}&signed=1`, request.url), 303);
}
