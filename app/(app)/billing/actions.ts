"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { emitAutomationEvent } from "@/lib/automation-engine";
import { pool, query } from "@/lib/db";
import type { PoolClient } from "pg";

const documentTypes = ["QUOTE", "INVOICE"] as const;
const documentStatuses = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

const createSchema = z.object({
  contactId: z.string().trim().min(1),
  documentType: z.enum(documentTypes),
  issueDate: z.string().date(),
  dueDate: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().trim().max(3000).optional(),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(100000),
  unitPrice: z.coerce.number().min(0).max(100000000),
  vatRate: z.coerce.number().min(0).max(100),
});

async function nextDocumentNumber(
  client: PoolClient,
  companyId: string,
  documentType: "QUOTE" | "INVOICE",
): Promise<string> {
  const year = new Date().getFullYear();
  
  const result = await client.query<{ current_value: number }>(
    `
    INSERT INTO document_sequences (
      company_id, document_type, year, current_value
    )
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (company_id, document_type, year)
    DO UPDATE SET current_value = document_sequences.current_value + 1
    RETURNING current_value
    `,
    [companyId, documentType, year],
  );

  const companyResult = await client.query<{
    quote_prefix: string;
    invoice_prefix: string;
  }>(
    `
    SELECT quote_prefix, invoice_prefix
    FROM companies
    WHERE id=$1
    LIMIT 1
    `,
    [companyId],
  );

  const settings = companyResult.rows[0];
  const prefix =
    documentType === "QUOTE"
      ? settings?.quote_prefix || "DEV"
      : settings?.invoice_prefix || "FAC";

  return `${prefix}-${year}-${String(result.rows[0].current_value).padStart(4, "0")}`;
}

export async function createSalesDocument(formData: FormData) {
  const member = await currentContext();

  const parsed = createSchema.safeParse({
    contactId: formData.get("contactId"),
    documentType: formData.get("documentType"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate") || undefined,
    validUntil: formData.get("validUntil") || undefined,
    notes: formData.get("notes") || "",
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    vatRate: formData.get("vatRate"),
  });

  if (!parsed.success) redirect("/billing?error=invalid");

  const contact = await query<{ id: string }>(
    "SELECT id FROM contacts WHERE id = $1 AND company_id = $2 LIMIT 1",
    [parsed.data.contactId, member.company_id],
  );

  if (!contact[0]) redirect("/billing?error=contact");

  const companySettings = await query<{
    payment_terms_days: number;
    quote_validity_days: number;
  }>(
    `
    SELECT payment_terms_days, quote_validity_days
    FROM companies
    WHERE id=$1
    LIMIT 1
    `,
    [member.company_id],
  );

  const defaults = companySettings[0];
  const automaticDueDate = new Date(parsed.data.issueDate);
  automaticDueDate.setDate(
    automaticDueDate.getDate() + Number(defaults?.payment_terms_days ?? 30),
  );

  const automaticValidUntil = new Date(parsed.data.issueDate);
  automaticValidUntil.setDate(
    automaticValidUntil.getDate() + Number(defaults?.quote_validity_days ?? 30),
  );

  const lineSubtotal = parsed.data.quantity * parsed.data.unitPrice;
  const lineVat = lineSubtotal * parsed.data.vatRate / 100;
  const lineTotal = lineSubtotal + lineVat;

  const client = await pool.connect();
  let documentId = "";

  try {
    await client.query("BEGIN");

    documentId = randomUUID();
    const number = await nextDocumentNumber(
      client,
      member.company_id,
      parsed.data.documentType,
    );

    await client.query(
      `
      INSERT INTO sales_documents (
        id, company_id, contact_id, document_type, document_number,
        status, issue_date, due_date, valid_until, currency, notes,
        subtotal, vat_amount, total, created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,'EUR',$9,$10,$11,$12,$13
      )
      `,
      [
        documentId,
        member.company_id,
        parsed.data.contactId,
        parsed.data.documentType,
        number,
        parsed.data.issueDate,
        parsed.data.dueDate ||
          (parsed.data.documentType === "INVOICE"
            ? automaticDueDate.toISOString().slice(0, 10)
            : null),
        parsed.data.validUntil ||
          (parsed.data.documentType === "QUOTE"
            ? automaticValidUntil.toISOString().slice(0, 10)
            : null),
        parsed.data.notes || null,
        lineSubtotal,
        lineVat,
        lineTotal,
        member.user_id,
      ],
    );

    await client.query(
      `
      INSERT INTO sales_document_items (
        id, document_id, description, quantity, unit_price,
        vat_rate, line_subtotal, line_vat, line_total, position
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)
      `,
      [
        randomUUID(),
        documentId,
        parsed.data.description,
        parsed.data.quantity,
        parsed.data.unitPrice,
        parsed.data.vatRate,
        lineSubtotal,
        lineVat,
        lineTotal,
      ],
    );

    await client.query(
      `
      INSERT INTO contact_activities (
        id, company_id, contact_id, actor_id, type, title, description
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        randomUUID(),
        member.company_id,
        parsed.data.contactId,
        member.user_id,
        parsed.data.documentType === "QUOTE" ? "QUOTE" : "INVOICE",
        parsed.data.documentType === "QUOTE" ? "Devis créé" : "Facture créée",
        `${number} — ${lineTotal.toLocaleString("fr-FR")} € TTC`,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    redirect("/billing?error=database");
  } finally {
    client.release();
  }

  await emitAutomationEvent(
    member.company_id,
    "INVOICE_CREATED",
    {
      invoice: {
        id: documentId,
        type: parsed.data.documentType,
        total: lineTotal,
      },
      contactId: parsed.data.contactId,
    },
    member.user_id,
  );

  revalidatePath("/billing");
  redirect(`/billing/${documentId}?created=1`);
}

export async function addDocumentItem(formData: FormData) {
  const member = await currentContext();
  const documentId = String(formData.get("documentId") ?? "");

  const schema = z.object({
    description: z.string().trim().min(1).max(500),
    quantity: z.coerce.number().positive().max(100000),
    unitPrice: z.coerce.number().min(0).max(100000000),
    vatRate: z.coerce.number().min(0).max(100),
  });

  const parsed = schema.safeParse({
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    vatRate: formData.get("vatRate"),
  });

  if (!documentId || !parsed.success) {
    redirect(`/billing/${documentId}?error=item`);
  }

  const document = await query<{ id: string }>(
    `
    SELECT id FROM sales_documents
    WHERE id = $1 AND company_id = $2
    LIMIT 1
    `,
    [documentId, member.company_id],
  );

  if (!document[0]) redirect("/billing");

  const subtotal = parsed.data.quantity * parsed.data.unitPrice;
  const vat = subtotal * parsed.data.vatRate / 100;
  const total = subtotal + vat;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const positionResult = await client.query<{ next_position: number }>(
      `
      SELECT COALESCE(MAX(position), 0) + 1 AS next_position
      FROM sales_document_items
      WHERE document_id = $1
      `,
      [documentId],
    );

    await client.query(
      `
      INSERT INTO sales_document_items (
        id, document_id, description, quantity, unit_price,
        vat_rate, line_subtotal, line_vat, line_total, position
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        randomUUID(),
        documentId,
        parsed.data.description,
        parsed.data.quantity,
        parsed.data.unitPrice,
        parsed.data.vatRate,
        subtotal,
        vat,
        total,
        positionResult.rows[0].next_position,
      ],
    );

    await client.query(
      `
      UPDATE sales_documents
      SET subtotal = totals.subtotal,
          vat_amount = totals.vat_amount,
          total = totals.total,
          updated_at = NOW()
      FROM (
        SELECT
          COALESCE(SUM(line_subtotal),0) AS subtotal,
          COALESCE(SUM(line_vat),0) AS vat_amount,
          COALESCE(SUM(line_total),0) AS total
        FROM sales_document_items
        WHERE document_id = $1
      ) totals
      WHERE sales_documents.id = $1
        AND sales_documents.company_id = $2
      `,
      [documentId, member.company_id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath(`/billing/${documentId}`);
  revalidatePath("/billing");
  redirect(`/billing/${documentId}?itemAdded=1`);
}

export async function updateDocumentStatus(formData: FormData) {
  const member = await currentContext();
  const documentId = String(formData.get("documentId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!documentStatuses.includes(status as (typeof documentStatuses)[number])) {
    redirect(`/billing/${documentId}?error=status`);
  }

  const updated = await query<any>(
    `
    UPDATE sales_documents
    SET status = $3, updated_at = NOW()
    WHERE id = $1 AND company_id = $2
    RETURNING id, document_number, total, contact_id
    `,
    [documentId, member.company_id, status],
  );

  if (status === "PAID" && updated[0]) {
    await emitAutomationEvent(
      member.company_id,
      "INVOICE_PAID",
      {
        invoice: {
          id: updated[0].id,
          number: updated[0].document_number,
          total: Number(updated[0].total),
          status: "PAID",
        },
        contactId: updated[0].contact_id,
      },
      member.user_id,
    );
  }

  revalidatePath("/billing");
  revalidatePath(`/billing/${documentId}`);
  redirect(`/billing/${documentId}?saved=1`);
}

export async function convertQuoteToInvoice(formData: FormData) {
  const member = await currentContext();
  const quoteId = String(formData.get("documentId") ?? "");
  const client = await pool.connect();
  let invoiceId = "";

  try {
    await client.query("BEGIN");

    const quoteResult = await client.query<any>(
      `
      SELECT *
      FROM sales_documents
      WHERE id = $1
        AND company_id = $2
        AND document_type = 'QUOTE'
      LIMIT 1
      `,
      [quoteId, member.company_id],
    );

    const quote = quoteResult.rows[0];
    if (!quote) {
      await client.query("ROLLBACK");
      redirect("/billing");
    }

    invoiceId = randomUUID();
    const invoiceNumber = await nextDocumentNumber(
      client,
      member.company_id,
      "INVOICE",
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    await client.query(
      `
      INSERT INTO sales_documents (
        id, company_id, contact_id, document_type, document_number,
        status, issue_date, due_date, currency, notes,
        subtotal, vat_amount, total, source_quote_id, created_by
      )
      VALUES (
        $1,$2,$3,'INVOICE',$4,'DRAFT',CURRENT_DATE,$5,$6,$7,
        $8,$9,$10,$11,$12
      )
      `,
      [
        invoiceId,
        member.company_id,
        quote.contact_id,
        invoiceNumber,
        dueDate.toISOString().slice(0, 10),
        quote.currency,
        quote.notes,
        quote.subtotal,
        quote.vat_amount,
        quote.total,
        quote.id,
        member.user_id,
      ],
    );

    await client.query(
      `
      INSERT INTO sales_document_items (
        id, document_id, description, quantity, unit_price,
        vat_rate, line_subtotal, line_vat, line_total, position
      )
      SELECT
        gen_random_uuid()::text,
        $1,
        description,
        quantity,
        unit_price,
        vat_rate,
        line_subtotal,
        line_vat,
        line_total,
        position
      FROM sales_document_items
      WHERE document_id = $2
      `,
      [invoiceId, quoteId],
    );

    await client.query(
      `
      UPDATE sales_documents
      SET status = 'ACCEPTED', updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      `,
      [quoteId, member.company_id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    redirect(`/billing/${quoteId}?error=conversion`);
  } finally {
    client.release();
  }

  revalidatePath("/billing");
  redirect(`/billing/${invoiceId}?converted=1`);
}

export async function deleteSalesDocument(formData: FormData) {
  const member = await currentContext();
  const documentId = String(formData.get("documentId") ?? "");

  await query(
    `
    DELETE FROM sales_documents
    WHERE id = $1 AND company_id = $2 AND status = 'DRAFT'
    `,
    [documentId, member.company_id],
  );

  revalidatePath("/billing");
  redirect("/billing?deleted=1");
}
