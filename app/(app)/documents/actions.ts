"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

const categories = [
  "INVOICE",
  "QUOTE",
  "CONTRACT",
  "HR",
  "IDENTITY",
  "BANK",
  "MARKETING",
  "OTHER",
] as const;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);

function sanitizeFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

export async function uploadDocument(formData: FormData) {
  const member = await currentContext();
  const file = formData.get("file");

  const parsed = z.object({
    name: z.string().trim().min(2).max(180),
    category: z.enum(categories),
    contactId: z.string().trim().optional(),
    notes: z.string().trim().max(2000).optional(),
  }).safeParse({
    name: formData.get("name"),
    category: formData.get("category") || "OTHER",
    contactId: formData.get("contactId") || "",
    notes: formData.get("notes") || "",
  });

  if (!(file instanceof File) || !parsed.success) {
    redirect("/documents?error=invalid");
  }

  if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
    redirect("/documents?error=size");
  }

  if (!allowedMimeTypes.has(file.type)) {
    redirect("/documents?error=format");
  }

  if (parsed.data.contactId) {
    const contact = await query<{ id: string }>(
      "SELECT id FROM contacts WHERE id=$1 AND company_id=$2 LIMIT 1",
      [parsed.data.contactId, member.company_id],
    );
    if (!contact[0]) redirect("/documents?error=contact");
  }

  const documentId = randomUUID();
  const extension = path.extname(file.name).slice(0, 12);
  const safeOriginal = sanitizeFilename(path.basename(file.name, extension));
  const storageFilename = `${documentId}-${safeOriginal}${extension}`;
  const relativeKey = path.join(member.company_id, storageFilename);
  const uploadRoot = path.join(process.cwd(), "storage", "uploads");
  const companyFolder = path.join(uploadRoot, member.company_id);
  const targetPath = path.join(companyFolder, storageFilename);

  await mkdir(companyFolder, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buffer, { flag: "wx" });

  try {
    await query(
      `
      INSERT INTO documents (
        id, company_id, contact_id, uploaded_by,
        name, original_name, storage_key, mime_type,
        size_bytes, category, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        documentId,
        member.company_id,
        parsed.data.contactId || null,
        member.user_id,
        parsed.data.name,
        file.name,
        relativeKey,
        file.type,
        file.size,
        parsed.data.category,
        parsed.data.notes || null,
      ],
    );

    if (parsed.data.contactId) {
      await query(
        `
        INSERT INTO contact_activities (
          id, company_id, contact_id, actor_id,
          type, title, description
        )
        VALUES ($1,$2,$3,$4,'DOCUMENT','Document ajouté',$5)
        `,
        [
          randomUUID(),
          member.company_id,
          parsed.data.contactId,
          member.user_id,
          `${parsed.data.name} — ${file.name}`,
        ],
      );
      revalidatePath(`/contacts/${parsed.data.contactId}`);
    }
  } catch (error) {
    await unlink(targetPath).catch(() => undefined);
    console.error(error);
    redirect("/documents?error=database");
  }

  revalidatePath("/documents");
  redirect("/documents?uploaded=1");
}

export async function deleteDocument(formData: FormData) {
  const member = await currentContext();
  const documentId = String(formData.get("documentId") ?? "");

  const rows = await query<{ storage_key: string }>(
    `
    DELETE FROM documents
    WHERE id=$1 AND company_id=$2
    RETURNING storage_key
    `,
    [documentId, member.company_id],
  );

  const document = rows[0];
  if (document) {
    const absolutePath = path.join(
      process.cwd(),
      "storage",
      "uploads",
      document.storage_key,
    );
    await unlink(absolutePath).catch(() => undefined);
  }

  revalidatePath("/documents");
  redirect("/documents?deleted=1");
}
