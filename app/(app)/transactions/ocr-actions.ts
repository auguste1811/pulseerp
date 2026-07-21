"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import {
  expenseAccounts,
  purchaseCategories,
  safeDate,
} from "@/lib/invoice-ocr";
import { prisma } from "@/lib/prisma";

const validationSchema = z.object({
  id: z.string().min(1),
  supplierName: z.string().trim().min(1).max(180),
  invoiceNumber: z.string().trim().max(120).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional(),
  category: z.enum(purchaseCategories),
  subtotal: z.coerce.number().nonnegative(),
  vatAmount: z.coerce.number().nonnegative(),
  total: z.coerce.number().positive(),
  notes: z.string().trim().max(3000).optional(),
});

export async function applyPurchaseInvoiceOcr(formData: FormData) {
  const member = await currentContext();

  const parsed = validationSchema.safeParse({
    id: formData.get("id"),
    supplierName: formData.get("supplierName"),
    invoiceNumber: formData.get("invoiceNumber"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    category: formData.get("category"),
    subtotal: formData.get("subtotal"),
    vatAmount: formData.get("vatAmount"),
    total: formData.get("total"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(
      `/transactions/ocr/${String(formData.get("id") || "")}?error=invalid`,
    );
  }

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: {
      id: parsed.data.id,
      companyId: member.company_id,
    },
  });

  if (!invoice) {
    redirect("/transactions?error=invoice-not-found");
  }

  const issueDate = safeDate(parsed.data.issueDate);
  const dueDate = parsed.data.dueDate
    ? safeDate(parsed.data.dueDate)
    : null;

  if (!issueDate) {
    redirect(`/transactions/ocr/${invoice.id}?error=date`);
  }

  const vatRate =
    parsed.data.subtotal > 0
      ? (parsed.data.vatAmount / parsed.data.subtotal) * 100
      : 0;

  const label = `${parsed.data.supplierName}${
    parsed.data.invoiceNumber
      ? ` — ${parsed.data.invoiceNumber}`
      : ""
  }`;

  await prisma.$transaction(async (tx: any) => {
    await tx.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        supplierName: parsed.data.supplierName,
        invoiceNumber: parsed.data.invoiceNumber || null,
        issueDate,
        dueDate,
        category: parsed.data.category,
        subtotal: parsed.data.subtotal,
        vatAmount: parsed.data.vatAmount,
        total: parsed.data.total,
        notes: parsed.data.notes || invoice.notes,
        ocrStatus: "VALIDATED",
        ocrError: null,
      },
    });

    await tx.transaction.updateMany({
      where: {
        purchaseInvoiceId: invoice.id,
        companyId: member.company_id,
      },
      data: {
        date: issueDate,
        label: `Facture achat — ${parsed.data.supplierName}`,
        category: parsed.data.category,
        amountExcludingTax: parsed.data.subtotal,
        vatRate,
        vatAmount: parsed.data.vatAmount,
        amountIncludingTax: parsed.data.total,
      },
    });

    await tx.accountingEntry.updateMany({
      where: {
        purchaseInvoiceId: invoice.id,
        accountNumber: { notIn: ["445660", "401000"] },
        debit: { gt: 0 },
      },
      data: {
        accountNumber: expenseAccounts[parsed.data.category],
        label,
        debit: parsed.data.subtotal,
        entryDate: issueDate,
      },
    });

    await tx.accountingEntry.updateMany({
      where: {
        purchaseInvoiceId: invoice.id,
        accountNumber: "445660",
      },
      data: {
        label,
        debit: parsed.data.vatAmount,
        entryDate: issueDate,
      },
    });

    await tx.accountingEntry.updateMany({
      where: {
        purchaseInvoiceId: invoice.id,
        accountNumber: "401000",
      },
      data: {
        label,
        credit: parsed.data.total,
        entryDate: issueDate,
      },
    });
  });

  revalidatePath("/transactions");
  revalidatePath(`/transactions/ocr/${invoice.id}`);
  revalidatePath("/dashboard");

  redirect("/transactions?ocr=validated");
}
