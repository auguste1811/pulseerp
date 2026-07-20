"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().min(2).max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  siret: z.string().trim().max(30).optional(),
  vatNumber: z.string().trim().max(40).optional(),
  iban: z.string().trim().max(60).optional(),
  bic: z.string().trim().max(30).optional(),
  currency: z.string().trim().min(3).max(3),
  defaultVatRate: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  quotePrefix: z.string().trim().min(2).max(10),
  invoicePrefix: z.string().trim().min(2).max(10),
  invoiceFooter: z.string().trim().max(2000).optional(),
});

export async function updateCompanySettings(formData: FormData) {
  const member = await requireRole("ADMIN");

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || "",
    address: formData.get("address") || "",
    postalCode: formData.get("postalCode") || "",
    city: formData.get("city") || "",
    country: formData.get("country") || "France",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    website: formData.get("website") || "",
    siret: formData.get("siret") || "",
    vatNumber: formData.get("vatNumber") || "",
    iban: formData.get("iban") || "",
    bic: formData.get("bic") || "",
    currency: formData.get("currency") || "EUR",
    defaultVatRate: formData.get("defaultVatRate") || 20,
    paymentTermsDays: formData.get("paymentTermsDays") || 30,
    quoteValidityDays: formData.get("quoteValidityDays") || 30,
    quotePrefix: formData.get("quotePrefix") || "DEV",
    invoicePrefix: formData.get("invoicePrefix") || "FAC",
    invoiceFooter: formData.get("invoiceFooter") || "",
  });

  if (!parsed.success) {
    redirect("/settings?error=invalid");
  }

  await query(
    `
    UPDATE companies
    SET name=$2,
        legal_name=$3,
        address=$4,
        postal_code=$5,
        city=$6,
        country=$7,
        email=$8,
        phone=$9,
        website=$10,
        siret=$11,
        vat_number=$12,
        iban=$13,
        bic=$14,
        currency=$15,
        default_vat_rate=$16,
        payment_terms_days=$17,
        quote_validity_days=$18,
        quote_prefix=$19,
        invoice_prefix=$20,
        invoice_footer=$21,
        updated_at=NOW()
    WHERE id=$1
    `,
    [
      member.company_id,
      parsed.data.name,
      parsed.data.legalName || null,
      parsed.data.address || null,
      parsed.data.postalCode || null,
      parsed.data.city || null,
      parsed.data.country,
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.website || null,
      parsed.data.siret || null,
      parsed.data.vatNumber || null,
      parsed.data.iban || null,
      parsed.data.bic || null,
      parsed.data.currency.toUpperCase(),
      parsed.data.defaultVatRate,
      parsed.data.paymentTermsDays,
      parsed.data.quoteValidityDays,
      parsed.data.quotePrefix.toUpperCase(),
      parsed.data.invoicePrefix.toUpperCase(),
      parsed.data.invoiceFooter || null,
    ],
  );

  revalidatePath("/settings");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}

export async function updateProfile(formData: FormData) {
  const member = await currentContext();

  const parsed = z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
  }).safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect("/settings?profileError=invalid");
  }

  const duplicate = await query<{ id: string }>(
    "SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND id<>$2 LIMIT 1",
    [parsed.data.email, member.user_id],
  );

  if (duplicate[0]) {
    redirect("/settings?profileError=email");
  }

  await query(
    `
    UPDATE users
    SET first_name=$2,
        last_name=$3,
        email=$4
    WHERE id=$1
    `,
    [
      member.user_id,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.email,
    ],
  );

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?profileSaved=1");
}

export async function changePassword(formData: FormData) {
  const member = await currentContext();

  const parsed = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10).max(128),
    confirmation: z.string().min(10).max(128),
  }).safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success || parsed.data.newPassword !== parsed.data.confirmation) {
    redirect("/settings?passwordError=invalid");
  }

  const users = await query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=$1 LIMIT 1",
    [member.user_id],
  );

  if (!users[0] || !(await bcrypt.compare(parsed.data.currentPassword, users[0].password_hash))) {
    redirect("/settings?passwordError=current");
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await query(
    "UPDATE users SET password_hash=$2 WHERE id=$1",
    [member.user_id, newHash],
  );

  redirect("/settings?passwordSaved=1");
}
