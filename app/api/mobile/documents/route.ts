import { NextResponse } from "next/server";
import { mobileContext } from "@/lib/mobile-auth";
import { ensureCompanySubscription } from "@/lib/subscription";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["INVOICE", "QUOTE", "CREDIT_NOTE"];

export async function GET(request: Request) {
  const ctx = await mobileContext(request);
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const access = await ensureCompanySubscription(ctx.company_id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Abonnement requis", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "ALL";
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim();

  const conditions = ["d.company_id = $1"];
  const params: unknown[] = [ctx.company_id];
  let index = 2;

  if (TYPES.includes(type)) {
    conditions.push(`d.document_type = $${index++}`);
    params.push(type);
  }
  if (status) {
    conditions.push(`d.status = $${index++}`);
    params.push(status.toUpperCase());
  }
  if (q) {
    conditions.push(
      `(d.document_number ILIKE $${index} OR COALESCE(c.company_name,'') ILIKE $${index} OR c.first_name ILIKE $${index} OR c.last_name ILIKE $${index})`,
    );
    params.push(`%${q}%`);
    index += 1;
  }

  const documents = await query<any>(
    `
    SELECT d.id, d.document_type, d.document_number, d.status, d.total,
           d.issue_date, d.due_date,
           COALESCE(c.company_name, CONCAT(c.first_name,' ',c.last_name), 'Client') AS client
    FROM sales_documents d
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY d.issue_date DESC, d.created_at DESC
    LIMIT 50
    `,
    params as never[],
  );

  return NextResponse.json({
    documents: documents.map((d: any) => ({
      id: d.id,
      type: d.document_type,
      number: d.document_number,
      status: d.status,
      total: Number(d.total),
      client: d.client,
      issueDate: d.issue_date,
      dueDate: d.due_date,
    })),
  });
}
