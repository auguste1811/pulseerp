"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { parseCsv, type CsvRow } from "@/lib/csv";
import { emitAutomationEvent } from "@/lib/automation-engine";
import { pool, query } from "@/lib/db";

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  companyName: z.string().trim().max(160).optional(),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().max(100).optional(),
  status: z.enum([
    "PROSPECT",
    "CONTACTED",
    "MEETING",
    "NEGOTIATION",
    "CUSTOMER",
    "LOST",
  ]),
  value: z.coerce.number().min(0).max(100000000),
});

const aliases: Record<string, string[]> = {
  firstName: ["first_name", "firstname", "prenom", "prénom"],
  lastName: ["last_name", "lastname", "nom"],
  companyName: ["company_name", "company", "entreprise", "societe", "société"],
  email: ["email", "mail", "adresse_email"],
  phone: ["phone", "telephone", "téléphone", "tel"],
  source: ["source", "acquisition_source", "canal"],
  status: ["status", "statut", "etape", "étape"],
  value: ["value", "valeur", "montant", "valeur_estimee"],
};

const statusAliases: Record<string, string> = {
  prospect: "PROSPECT",
  contacte: "CONTACTED",
  contacté: "CONTACTED",
  contacted: "CONTACTED",
  "rendez-vous": "MEETING",
  rendez_vous: "MEETING",
  meeting: "MEETING",
  negociation: "NEGOTIATION",
  négociation: "NEGOTIATION",
  negotiation: "NEGOTIATION",
  client: "CUSTOMER",
  customer: "CUSTOMER",
  perdu: "LOST",
  lost: "LOST",
};

function pick(row: CsvRow, field: keyof typeof aliases): string {
  for (const alias of aliases[field]) {
    if (row[alias] !== undefined && row[alias] !== "") return row[alias];
  }
  return "";
}

function normalizeStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  return statusAliases[normalized] ?? (value.trim().toUpperCase() || "PROSPECT");
}

export async function createContact(formData: FormData) {
  const member = await currentContext();

  const parsed = contactSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    companyName: formData.get("companyName") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    source: formData.get("source") || "",
    status: formData.get("status") || "PROSPECT",
    value: formData.get("value") || 0,
  });

  if (!parsed.success) redirect("/contacts?error=invalid");

  const contactId = randomUUID();

  await query(
    `
    INSERT INTO contacts (
      id, company_id, first_name, last_name, company_name,
      email, phone, source, status, value
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      contactId,
      member.company_id,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.companyName || null,
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.source || null,
      parsed.data.status,
      parsed.data.value,
    ],
  );

  await query(
    `
    INSERT INTO contact_activities (
      id, company_id, contact_id, actor_id, type, title, description
    )
    VALUES ($1,$2,$3,$4,'CREATED','Contact créé',$5)
    `,
    [
      randomUUID(),
      member.company_id,
      contactId,
      member.user_id,
      `${parsed.data.firstName} ${parsed.data.lastName} a été ajouté au CRM.`,
    ],
  );

  await emitAutomationEvent(
    member.company_id,
    "CONTACT_CREATED",
    {
      contact: {
        id: contactId,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        source: parsed.data.source || null,
        status: parsed.data.status,
        value: parsed.data.value,
      },
    },
    member.user_id,
  );

  revalidatePath("/contacts");
  revalidatePath("/contacts/pipeline");
}

export async function importContactsCsv(formData: FormData) {
  const member = await currentContext();
  const uploaded = formData.get("csvFile");

  if (!(uploaded instanceof File)) {
    redirect("/contacts?importError=file");
  }

  if (uploaded.size === 0 || uploaded.size > 2_000_000) {
    redirect("/contacts?importError=size");
  }

  const filename = uploaded.name.toLowerCase();
  if (!filename.endsWith(".csv")) {
    redirect("/contacts?importError=format");
  }

  const content = await uploaded.text();
  const rows = parseCsv(content);

  if (rows.length === 0 || rows.length > 5000) {
    redirect("/contacts?importError=rows");
  }

  const validContacts: Array<z.infer<typeof contactSchema>> = [];
  let rejected = 0;

  for (const row of rows) {
    const rawValue = pick(row, "value")
      .replace(/\s/g, "")
      .replace(",", ".");

    const parsed = contactSchema.safeParse({
      firstName: pick(row, "firstName"),
      lastName: pick(row, "lastName"),
      companyName: pick(row, "companyName"),
      email: pick(row, "email").toLowerCase(),
      phone: pick(row, "phone"),
      source: pick(row, "source"),
      status: normalizeStatus(pick(row, "status") || "PROSPECT"),
      value: rawValue || 0,
    });

    if (parsed.success) validContacts.push(parsed.data);
    else rejected += 1;
  }

  if (validContacts.length === 0) {
    redirect(`/contacts?importError=invalid&rejected=${rejected}`);
  }

  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");

    for (const contact of validContacts) {
      if (contact.email) {
        const existing = await client.query<{ id: string }>(
          `
          SELECT id
          FROM contacts
          WHERE company_id = $1 AND LOWER(email) = LOWER($2)
          LIMIT 1
          `,
          [member.company_id, contact.email],
        );

        if (existing.rows[0]) {
          await client.query(
            `
            UPDATE contacts
            SET first_name = $3,
                last_name = $4,
                company_name = $5,
                phone = $6,
                source = $7,
                status = $8,
                value = $9
            WHERE id = $1 AND company_id = $2
            `,
            [
              existing.rows[0].id,
              member.company_id,
              contact.firstName,
              contact.lastName,
              contact.companyName || null,
              contact.phone || null,
              contact.source || null,
              contact.status,
              contact.value,
            ],
          );
          updated += 1;
          continue;
        }
      }

      await client.query(
        `
        INSERT INTO contacts (
          id, company_id, first_name, last_name, company_name,
          email, phone, source, status, value
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          randomUUID(),
          member.company_id,
          contact.firstName,
          contact.lastName,
          contact.companyName || null,
          contact.email || null,
          contact.phone || null,
          contact.source || null,
          contact.status,
          contact.value,
        ],
      );
      inserted += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CSV contact import failed:", error);
    redirect("/contacts?importError=database");
  } finally {
    client.release();
  }

  revalidatePath("/contacts");
  redirect(
    `/contacts?imported=${inserted}&updated=${updated}&rejected=${rejected}`,
  );
}


const contactStatuses = [
  "PROSPECT",
  "CONTACTED",
  "MEETING",
  "NEGOTIATION",
  "CUSTOMER",
  "LOST",
] as const;

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export async function moveContactStage(contactId: string, status: string) {
  const member = await currentContext();

  if (!contactStatuses.includes(status as (typeof contactStatuses)[number])) {
    throw new Error("Statut CRM invalide.");
  }

  const existing = await query<{ first_name: string; last_name: string; status: string }>(
    `
    SELECT first_name, last_name, status
    FROM contacts
    WHERE id = $1 AND company_id = $2
    LIMIT 1
    `,
    [contactId, member.company_id],
  );

  if (!existing[0] || existing[0].status === status) return;

  await query(
    `
    UPDATE contacts
    SET status = $3, updated_at = NOW()
    WHERE id = $1 AND company_id = $2
    `,
    [contactId, member.company_id, status],
  );

  await query(
    `
    INSERT INTO contact_activities (
      id, company_id, contact_id, actor_id, type, title, description
    )
    VALUES ($1,$2,$3,$4,'STAGE_CHANGED','Étape commerciale modifiée',$5)
    `,
    [
      randomUUID(),
      member.company_id,
      contactId,
      member.user_id,
      `Le contact est passé de ${existing[0].status} à ${status}.`,
    ],
  );

  await emitAutomationEvent(
    member.company_id,
    "CONTACT_STATUS_CHANGED",
    {
      contact: {
        id: contactId,
        first_name: existing[0].first_name,
        last_name: existing[0].last_name,
        previous_status: existing[0].status,
        status,
      },
    },
    member.user_id,
  );

  revalidatePath("/contacts");
  revalidatePath("/contacts/pipeline");
  revalidatePath(`/contacts/${contactId}`);
}

export async function updateContact(formData: FormData) {
  const member = await currentContext();
  const contactId = String(formData.get("contactId") ?? "");

  const schema = z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    companyName: z.string().trim().max(160),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]),
    phone: z.string().trim().max(40),
    source: z.string().trim().max(100),
    status: z.enum(contactStatuses),
    priority: z.enum(priorities),
    value: z.coerce.number().min(0).max(100000000),
    address: z.string().trim().max(500),
    siret: z.string().trim().max(30),
    vatNumber: z.string().trim().max(40),
    tags: z.string().trim().max(500),
  });

  const parsed = schema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    companyName: formData.get("companyName") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    source: formData.get("source") || "",
    status: formData.get("status") || "PROSPECT",
    priority: formData.get("priority") || "MEDIUM",
    value: formData.get("value") || 0,
    address: formData.get("address") || "",
    siret: formData.get("siret") || "",
    vatNumber: formData.get("vatNumber") || "",
    tags: formData.get("tags") || "",
  });

  if (!contactId || !parsed.success) {
    redirect(`/contacts/${contactId}?error=invalid`);
  }

  const tags = parsed.data.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);

  const result = await query<{ id: string }>(
    `
    UPDATE contacts
    SET first_name = $3,
        last_name = $4,
        company_name = $5,
        email = $6,
        phone = $7,
        source = $8,
        status = $9,
        value = $10,
        address = $11,
        siret = $12,
        vat_number = $13,
        priority = $14,
        tags = $15,
        updated_at = NOW()
    WHERE id = $1 AND company_id = $2
    RETURNING id
    `,
    [
      contactId,
      member.company_id,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.companyName || null,
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.source || null,
      parsed.data.status,
      parsed.data.value,
      parsed.data.address || null,
      parsed.data.siret || null,
      parsed.data.vatNumber || null,
      parsed.data.priority,
      tags,
    ],
  );

  if (!result[0]) redirect("/contacts");

  await query(
    `
    INSERT INTO contact_activities (
      id, company_id, contact_id, actor_id, type, title, description
    )
    VALUES ($1,$2,$3,$4,'UPDATED','Fiche client mise à jour',$5)
    `,
    [
      randomUUID(),
      member.company_id,
      contactId,
      member.user_id,
      "Les informations générales du contact ont été modifiées.",
    ],
  );

  revalidatePath("/contacts");
  revalidatePath("/contacts/pipeline");
  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}?saved=1`);
}

export async function addContactNote(formData: FormData) {
  const member = await currentContext();
  const contactId = String(formData.get("contactId") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  if (!contactId || content.length < 2 || content.length > 5000) {
    redirect(`/contacts/${contactId}?noteError=invalid`);
  }

  const contact = await query<{ id: string }>(
    "SELECT id FROM contacts WHERE id = $1 AND company_id = $2 LIMIT 1",
    [contactId, member.company_id],
  );

  if (!contact[0]) redirect("/contacts");

  await query(
    `
    INSERT INTO contact_notes (
      id, company_id, contact_id, author_id, content
    )
    VALUES ($1,$2,$3,$4,$5)
    `,
    [randomUUID(), member.company_id, contactId, member.user_id, content],
  );

  await query(
    `
    INSERT INTO contact_activities (
      id, company_id, contact_id, actor_id, type, title, description
    )
    VALUES ($1,$2,$3,$4,'NOTE','Note ajoutée',$5)
    `,
    [
      randomUUID(),
      member.company_id,
      contactId,
      member.user_id,
      content.length > 140 ? `${content.slice(0, 137)}...` : content,
    ],
  );

  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}?noteAdded=1`);
}

export async function addContactActivity(formData: FormData) {
  const member = await currentContext();
  const contactId = String(formData.get("contactId") ?? "");
  const type = String(formData.get("type") ?? "CALL").toUpperCase();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const allowed = ["CALL", "EMAIL", "MEETING", "FOLLOW_UP"];
  if (!contactId || !allowed.includes(type) || title.length < 2 || title.length > 200) {
    redirect(`/contacts/${contactId}?activityError=invalid`);
  }

  const contact = await query<{ id: string }>(
    "SELECT id FROM contacts WHERE id = $1 AND company_id = $2 LIMIT 1",
    [contactId, member.company_id],
  );
  if (!contact[0]) redirect("/contacts");

  await query(
    `
    INSERT INTO contact_activities (
      id, company_id, contact_id, actor_id, type, title, description
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      randomUUID(),
      member.company_id,
      contactId,
      member.user_id,
      type,
      title,
      description || null,
    ],
  );

  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}?activityAdded=1`);
}

export async function deleteContact(formData: FormData) {
  const member = await currentContext();
  const contactId = String(formData.get("contactId") ?? "");

  if (!contactId) redirect("/contacts");

  await query(
    "DELETE FROM contacts WHERE id = $1 AND company_id = $2",
    [contactId, member.company_id],
  );

  revalidatePath("/contacts");
  revalidatePath("/contacts/pipeline");
  redirect("/contacts?deleted=1");
}
