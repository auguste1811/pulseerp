import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mobileContext } from "@/lib/mobile-auth";
import { ensureCompanySubscription } from "@/lib/subscription";
import { query } from "@/lib/db";

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

export async function GET(request: Request) {
  const { error, ctx } = await guarded(request);
  if (error || !ctx) return error as Response;

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  const params: unknown[] = [ctx.company_id];
  let where = "c.company_id = $1";
  if (q) {
    where += ` AND (c.first_name ILIKE $2 OR c.last_name ILIKE $2 OR COALESCE(c.company_name,'') ILIKE $2 OR COALESCE(c.email,'') ILIKE $2)`;
    params.push(`%${q}%`);
  }

  const contacts = await query<any>(
    `
    SELECT c.id, c.first_name, c.last_name, c.company_name, c.email, c.phone,
           c.status, c.created_at,
           (SELECT COALESCE(SUM(d.total),0) FROM sales_documents d
            WHERE d.contact_id = c.id AND d.document_type = 'INVOICE' AND d.status <> 'CANCELLED') AS chiffre_affaires
    FROM contacts c
    WHERE ${where}
    ORDER BY c.created_at DESC
    LIMIT 50
    `,
    params as never[],
  );

  return NextResponse.json({
    contacts: contacts.map((c: any) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      companyName: c.company_name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      chiffreAffaires: Number(c.chiffre_affaires || 0),
    })),
  });
}

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  companyName: z.string().trim().max(160).optional(),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const { error, ctx } = await guarded(request);
  if (error || !ctx) return error as Response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });
  }

  const id = randomUUID();
  await query(
    `INSERT INTO contacts (id, company_id, first_name, last_name, company_name, email, phone, status, assigned_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'PROSPECT',$8)`,
    [
      id,
      ctx.company_id,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.companyName || null,
      parsed.data.email || null,
      parsed.data.phone || null,
      ctx.user_id,
    ],
  );

  return NextResponse.json({ id }, { status: 201 });
}
