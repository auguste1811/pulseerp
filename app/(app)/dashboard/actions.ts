"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

const manualRevenueSchema = z.object({
  date: z.string().min(1),
  label: z.string().trim().min(2).max(200),
  revenueSource: z.string().trim().min(2).max(120),
  category: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive().max(100000000),
  vatRate: z.coerce.number().min(0).max(100),
  status: z.enum(["PAID", "PENDING"]),
});

export async function createManualRevenue(formData: FormData) {
  const member = await currentContext();

  const parsed = manualRevenueSchema.safeParse({
    date: formData.get("date"),
    label: formData.get("label"),
    revenueSource: formData.get("revenueSource"),
    category: formData.get("category") || "",
    amount: formData.get("amount"),
    vatRate: formData.get("vatRate") || 0,
    status: formData.get("status") || "PAID",
  });

  if (!parsed.success) redirect("/dashboard?revenueError=invalid");

  const vatAmount = parsed.data.amount * (parsed.data.vatRate / 100);
  const total = parsed.data.amount + vatAmount;

  await query(
    `
    INSERT INTO transactions (
      id, company_id, type, status, date, label, category,
      amount_excluding_tax, vat_rate, vat_amount,
      amount_including_tax, revenue_source
    )
    VALUES ($1,$2,'INCOME',$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `,
    [
      crypto.randomUUID(),
      member.company_id,
      parsed.data.status,
      parsed.data.date,
      parsed.data.label,
      parsed.data.category || null,
      parsed.data.amount,
      parsed.data.vatRate,
      vatAmount,
      total,
      parsed.data.revenueSource,
    ],
  );

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  redirect("/dashboard?revenueCreated=1");
}
