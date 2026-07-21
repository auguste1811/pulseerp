"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { pool, query } from "@/lib/db";

const categories = [
  "TO_CLASSIFY", "PURCHASES", "SUPPLIES", "SOFTWARE", "TELECOM",
  "VEHICLE", "TRAVEL", "ADVERTISING", "INSURANCE", "BANK", "RENT", "OTHER",
] as const;

const importSchema = z.object({
  supplierName: z.string().trim().min(2).max(180),
  invoiceNumber: z.string().trim().max(100).optional(),
  issueDate: z.string().date(),
  dueDate: z.string().date().optional(),
  category: z.enum(categories),
  status: z.enum(["PENDING", "PAID", "OVERDUE"]),
  subtotal: z.coerce.number().min(0).max(100000000),
  vatAmount: z.coerce.number().min(0).max(100000000),
  total: z.coerce.number().positive().max(100000000),
  notes: z.string().trim().max(2000).optional(),
});

function expenseAccount(category: string) {
  const map: Record<string, string> = {
    PURCHASES: "607000", SUPPLIES: "606300", SOFTWARE: "615600",
    TELECOM: "626000", VEHICLE: "625100", TRAVEL: "625100",
    ADVERTISING: "623000", INSURANCE: "616000", BANK: "627000",
    RENT: "613200", OTHER: "658000", TO_CLASSIFY: "471000",
  };
  return map[category] || "471000";
}

export async function importPurchaseInvoice(formData: FormData) {
  const member = await currentContext();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/transactions?error=file");

  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
    redirect("/transactions?error=file");
  }

  const parsed = importSchema.safeParse({
    supplierName: formData.get("supplierName"),
    invoiceNumber: formData.get("invoiceNumber") || undefined,
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate") || undefined,
    category: formData.get("category"),
    status: formData.get("status"),
    subtotal: formData.get("subtotal"),
    vatAmount: formData.get("vatAmount"),
    total: formData.get("total"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/transactions?error=invalid");

  const data = Buffer.from(await file.arrayBuffer());
  const invoiceId = randomUUID();
  const transactionId = randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO purchase_invoices (
        id, company_id, uploaded_by, supplier_name, invoice_number,
        issue_date, due_date, category, status, subtotal, vat_amount,
        total, notes, original_name, mime_type, size_bytes, file_data
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [invoiceId, member.company_id, member.user_id, parsed.data.supplierName,
       parsed.data.invoiceNumber || null, parsed.data.issueDate,
       parsed.data.dueDate || null, parsed.data.category, parsed.data.status,
       parsed.data.subtotal, parsed.data.vatAmount, parsed.data.total,
       parsed.data.notes || null, file.name, file.type, file.size, data],
    );

    const vatRate = parsed.data.subtotal > 0
      ? parsed.data.vatAmount / parsed.data.subtotal * 100 : 0;
    await client.query(
      `INSERT INTO transactions (
        id, company_id, type, status, date, label, category,
        amount_excluding_tax, vat_rate, vat_amount, amount_including_tax,
        purchase_invoice_id
      ) VALUES ($1,$2,'EXPENSE',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [transactionId, member.company_id, parsed.data.status, parsed.data.issueDate,
       `Facture achat — ${parsed.data.supplierName}`, parsed.data.category,
       parsed.data.subtotal, vatRate, parsed.data.vatAmount,
       parsed.data.total, invoiceId],
    );

    const label = `${parsed.data.supplierName}${parsed.data.invoiceNumber ? ` — ${parsed.data.invoiceNumber}` : ""}`;
    await client.query(
      `INSERT INTO accounting_entries
        (id, company_id, purchase_invoice_id, entry_date, journal, account_number, label, debit, credit)
       VALUES
        ($1,$2,$3,$4,'ACH',$5,$6,$7,0),
        ($8,$2,$3,$4,'ACH','445660',$6,$9,0),
        ($10,$2,$3,$4,'ACH','401000',$6,0,$11)`,
      [randomUUID(), member.company_id, invoiceId, parsed.data.issueDate,
       expenseAccount(parsed.data.category), label, parsed.data.subtotal,
       randomUUID(), parsed.data.vatAmount, randomUUID(), parsed.data.total],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    redirect("/transactions?error=database");
  } finally { client.release(); }

  revalidatePath("/transactions");
  redirect("/transactions?imported=1");
}

export async function classifyPurchaseInvoice(formData: FormData) {
  const member = await currentContext();
  const id = String(formData.get("id") || "");
  const category = String(formData.get("category") || "");
  if (!categories.includes(category as any)) redirect("/transactions?error=category");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE purchase_invoices SET category=$3, updated_at=NOW()
       WHERE id=$1 AND company_id=$2`, [id, member.company_id, category]);
    await client.query(
      `UPDATE transactions SET category=$3
       WHERE purchase_invoice_id=$1 AND company_id=$2`, [id, member.company_id, category]);
    await client.query(
      `UPDATE accounting_entries SET account_number=$3
       WHERE purchase_invoice_id=$1 AND company_id=$2
         AND journal='ACH' AND debit > 0 AND account_number <> '445660'`,
      [id, member.company_id, expenseAccount(category)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  revalidatePath("/transactions");
}

export async function changePurchaseStatus(formData: FormData) {
  const member = await currentContext();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["PENDING", "PAID", "OVERDUE"].includes(status)) return;
  await query(`UPDATE purchase_invoices SET status=$3, updated_at=NOW()
               WHERE id=$1 AND company_id=$2`, [id, member.company_id, status]);
  await query(`UPDATE transactions SET status=$3
               WHERE purchase_invoice_id=$1 AND company_id=$2`, [id, member.company_id, status]);
  revalidatePath("/transactions");
}
