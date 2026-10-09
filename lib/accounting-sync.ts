import { query } from "@/lib/db";

export async function syncInvoiceWithAccounting(
  companyId: string,
  invoiceId: string,
) {
  await query(
    `
    INSERT INTO transactions (
      id, company_id, type, status, date, label, category,
      amount_excluding_tax, vat_rate, vat_amount,
      amount_including_tax, sales_document_id, created_at
    )
    SELECT
      gen_random_uuid()::text,
      d.company_id,
      'INCOME',
      CASE
        WHEN d.status = 'PAID' THEN 'PAID'
        WHEN d.status = 'OVERDUE' THEN 'OVERDUE'
        ELSE 'PENDING'
      END,
      d.issue_date,
      'Facture ' || d.document_number ||
        COALESCE(' — ' || NULLIF(TRIM(c.company_name), ''), ''),
      'Vente',
      d.subtotal,
      CASE WHEN d.subtotal > 0
        THEN ROUND((d.vat_amount / d.subtotal) * 100, 2)
        ELSE 0
      END,
      d.vat_amount,
      d.total,
      d.id,
      NOW()
    FROM sales_documents d
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = $1
      AND d.company_id = $2
      AND d.document_type = 'INVOICE'
      AND d.status <> 'CANCELLED'
    ON CONFLICT (sales_document_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      date = EXCLUDED.date,
      label = EXCLUDED.label,
      amount_excluding_tax = EXCLUDED.amount_excluding_tax,
      vat_rate = EXCLUDED.vat_rate,
      vat_amount = EXCLUDED.vat_amount,
      amount_including_tax = EXCLUDED.amount_including_tax
    `,
    [invoiceId, companyId],
  );
}

export async function syncCreditNoteWithAccounting(
  companyId: string,
  creditNoteId: string,
) {
  // Un avoir storne le produit constaté : montants négatifs en INCOME.
  await query(
    `
    INSERT INTO transactions (
      id, company_id, type, status, date, label, category,
      amount_excluding_tax, vat_rate, vat_amount,
      amount_including_tax, sales_document_id, created_at
    )
    SELECT
      gen_random_uuid()::text,
      d.company_id,
      'INCOME',
      CASE
        WHEN d.status = 'PAID' THEN 'PAID'
        WHEN d.status = 'OVERDUE' THEN 'OVERDUE'
        ELSE 'PENDING'
      END,
      d.issue_date,
      'Avoir ' || d.document_number ||
        COALESCE(' — ' || NULLIF(TRIM(c.company_name), ''), ''),
      'Avoir',
      -d.subtotal,
      CASE WHEN d.subtotal > 0
        THEN ROUND((d.vat_amount / d.subtotal) * 100, 2)
        ELSE 0
      END,
      -d.vat_amount,
      -d.total,
      d.id,
      NOW()
    FROM sales_documents d
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = $1
      AND d.company_id = $2
      AND d.document_type = 'CREDIT_NOTE'
      AND d.status <> 'CANCELLED'
    ON CONFLICT (sales_document_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      date = EXCLUDED.date,
      label = EXCLUDED.label,
      amount_excluding_tax = EXCLUDED.amount_excluding_tax,
      vat_rate = EXCLUDED.vat_rate,
      vat_amount = EXCLUDED.vat_amount,
      amount_including_tax = EXCLUDED.amount_including_tax
    `,
    [creditNoteId, companyId],
  );
}
