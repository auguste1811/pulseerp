"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  status: z.enum(["PAID", "PENDING", "OVERDUE"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().trim().min(2).max(200),
  category: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive().max(100_000_000),
  vatRate: z.coerce.number().min(0).max(100),
  revenueSource: z.string().trim().max(120).optional(),
});

export async function createTransaction(formData: FormData) {
  const member = await currentContext();

  const parsed = transactionSchema.safeParse({
    type: formData.get("type"),
    status: formData.get("status") || "PENDING",
    date: formData.get("date"),
    label: formData.get("label"),
    category: formData.get("category") || "",
    amount: formData.get("amount"),
    vatRate: formData.get("vatRate") || 0,
    revenueSource: formData.get("revenueSource") || "",
  });

  if (!parsed.success) {
    redirect("/transactions?error=invalid");
  }

  const vatAmount = parsed.data.amount * (parsed.data.vatRate / 100);
  const total = parsed.data.amount + vatAmount;

  await query(
    `
    INSERT INTO transactions (
      id, company_id, type, status, date, label, category,
      amount_excluding_tax, vat_rate, vat_amount,
      amount_including_tax, revenue_source
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `,
    [
      randomUUID(),
      member.company_id,
      parsed.data.type,
      parsed.data.status,
      parsed.data.date,
      parsed.data.label,
      parsed.data.category || null,
      parsed.data.amount,
      parsed.data.vatRate,
      vatAmount,
      total,
      parsed.data.type === "INCOME"
        ? parsed.data.revenueSource || null
        : null,
    ],
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect("/transactions?created=1");
}
