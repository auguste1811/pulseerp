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
  groupId: z.string().trim().optional(),
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
    groupId: formData.get("groupId") || "",
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

  if (parsed.data.groupId) {
    const group = await query<{id:string}>("SELECT id FROM contact_groups WHERE id=$1 AND company_id=$2 LIMIT 1", [parsed.data.groupId, member.company_id]);
    if (group[0]) await query("INSERT INTO contact_group_members (group_id,contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [parsed.data.groupId, contactId]);
  }

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
  const groupId = String(formData.get("groupId") || "");
  if (groupId) {
    const group = await query<{id:string}>("SELECT id FROM contact_groups WHERE id=$1 AND company_id=$2 LIMIT 1", [groupId, member.company_id]);
    if (!group[0]) redirect("/contacts?importError=group");
  }

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
          if (groupId) await client.query("INSERT INTO contact_group_members (group_id,contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [groupId, existing.rows[0].id]);
          updated += 1;
          continue;
        }
      }

      const importedContactId = randomUUID();
      await client.query(
        `
        INSERT INTO contacts (
          id, company_id, first_name, last_name, company_name,
          email, phone, source, status, value
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          importedContactId,
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
      if (groupId) await client.query("INSERT INTO contact_group_members (group_id,contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [groupId, importedContactId]);
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


export async function scheduleContactMeeting(formData: FormData) {
  const member = await currentContext();
  const contactId = String(formData.get("contactId") || "");
  const title = String(formData.get("title") || "").trim();
  const startAtRaw = String(formData.get("startAt") || "");
  const durationMinutes = Number(formData.get("durationMinutes") || 60);
  const location = String(formData.get("location") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (
    !contactId ||
    title.length < 2 ||
    !startAtRaw ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 480
  ) {
    redirect(`/contacts/${contactId}?meetingError=invalid`);
  }

  const contact = await query<{
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
  }>(
    `
    SELECT id, first_name, last_name, company_name
    FROM contacts
    WHERE id=$1 AND company_id=$2
    LIMIT 1
    `,
    [contactId, member.company_id],
  );

  if (!contact[0]) redirect("/contacts");

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
    redirect(`/contacts/${contactId}?meetingError=date`);
  }

  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
  const eventId = randomUUID();

  await query(
    `
    INSERT INTO calendar_events (
      id, company_id, contact_id, assigned_user_id,
      title, description, event_type, status,
      start_at, end_at, location, reminder_minutes, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,'MEETING','PLANNED',$7,$8,$9,30,$10)
    `,
    [
      eventId,
      member.company_id,
      contactId,
      member.user_id,
      title,
      description || null,
      startAt.toISOString(),
      endAt.toISOString(),
      location || null,
      member.user_id,
    ],
  );

  await query(
    `
    INSERT INTO contact_activities (
      id, company_id, contact_id, actor_id, type, title, description
    )
    VALUES ($1,$2,$3,$4,'MEETING','Prochain rendez-vous planifié',$5)
    `,
    [
      randomUUID(),
      member.company_id,
      contactId,
      member.user_id,
      `${title} — ${startAt.toLocaleString("fr-FR")}`,
    ],
  );

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/contacts/${contactId}?meetingCreated=1`);
}


const callStatuses = ["COMPLETED","NO_ANSWER","BUSY","VOICEMAIL","FAILED"] as const;
const callOutcomes = ["QUALIFIED","FOLLOW_UP","MEETING_BOOKED","NOT_INTERESTED","SALE","OTHER"] as const;

export async function logCrmCall(formData: FormData) {
  const member = await currentContext();
  const contactId = String(formData.get("contactId") || "").trim();

  const parsed = z.object({
    direction: z.enum(["OUTBOUND", "INBOUND"]),
    status: z.enum(callStatuses),
    outcome: z.union([z.literal(""), z.enum(callOutcomes)]),
    startedAt: z.string().min(1),
    durationMinutes: z.coerce.number().int().min(0).max(480),
    durationSeconds: z.coerce.number().int().min(0).max(59),
    phoneNumber: z.string().trim().max(40),
    summary: z.string().trim().max(5000),
    nextAction: z.string().trim().max(500),
    followUpAt: z.string().optional(),
    createFollowUpTask: z.boolean().default(false),
  }).safeParse({
    direction: formData.get("direction") || "OUTBOUND",
    status: formData.get("status") || "COMPLETED",
    outcome: formData.get("outcome") || "",
    startedAt: formData.get("startedAt"),
    durationMinutes: formData.get("durationMinutes") || 0,
    durationSeconds: formData.get("durationSeconds") || 0,
    phoneNumber: formData.get("phoneNumber") || "",
    summary: formData.get("summary") || "",
    nextAction: formData.get("nextAction") || "",
    followUpAt: formData.get("followUpAt") || "",
    createFollowUpTask: formData.get("createFollowUpTask") === "on",
  });

  if (!contactId || !parsed.success) redirect(`/contacts/${contactId}?callError=invalid`);

  const contact = await query<{id:string;first_name:string;last_name:string;phone:string|null}>(
    "SELECT id,first_name,last_name,phone FROM contacts WHERE id=$1 AND company_id=$2 LIMIT 1",
    [contactId, member.company_id],
  );
  if (!contact[0]) redirect("/contacts");

  const startedAt = new Date(parsed.data.startedAt);
  const followUpAt = parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null;
  if (Number.isNaN(startedAt.getTime()) || (followUpAt && Number.isNaN(followUpAt.getTime()))) {
    redirect(`/contacts/${contactId}?callError=date`);
  }

  const totalSeconds = parsed.data.durationMinutes * 60 + parsed.data.durationSeconds;

  await query(
    `INSERT INTO crm_calls (
      id,company_id,contact_id,created_by_id,direction,status,outcome,started_at,
      duration_seconds,phone_number,summary,next_action,follow_up_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      randomUUID(), member.company_id, contactId, member.user_id,
      parsed.data.direction, parsed.data.status, parsed.data.outcome || null,
      startedAt.toISOString(), totalSeconds,
      parsed.data.phoneNumber || contact[0].phone || null,
      parsed.data.summary || null, parsed.data.nextAction || null,
      followUpAt?.toISOString() || null,
    ],
  );

  await query(
    `INSERT INTO contact_activities (
      id,company_id,contact_id,actor_id,type,title,description
    ) VALUES ($1,$2,$3,$4,'CALL',$5,$6)`,
    [
      randomUUID(), member.company_id, contactId, member.user_id,
      parsed.data.direction === "OUTBOUND" ? "Appel sortant enregistré" : "Appel entrant enregistré",
      parsed.data.summary || `${parsed.data.status} · ${totalSeconds} seconde(s)`,
    ],
  );

  if (followUpAt && parsed.data.nextAction) {
    const endAt = new Date(followUpAt.getTime() + 30 * 60_000);
    await query(
      `INSERT INTO calendar_events (
        id,company_id,contact_id,assigned_user_id,title,description,event_type,status,
        start_at,end_at,reminder_minutes,created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,'FOLLOW_UP','PLANNED',$7,$8,30,$9)`,
      [
        randomUUID(), member.company_id, contactId, member.user_id,
        parsed.data.nextAction, parsed.data.summary || null,
        followUpAt.toISOString(), endAt.toISOString(), member.user_id,
      ],
    );
  }

  if (parsed.data.createFollowUpTask && followUpAt && parsed.data.nextAction) {
    await query(
      `INSERT INTO tasks (
        id,company_id,title,description,status,priority,due_date,assigned_user_id
      ) VALUES ($1,$2,$3,$4,'TODO','HIGH',$5,$6)`,
      [
        randomUUID(), member.company_id, parsed.data.nextAction,
        `Relance téléphonique de ${contact[0].first_name} ${contact[0].last_name}`,
        followUpAt.toISOString().slice(0,10), member.user_id,
      ],
    );
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/contacts/${contactId}?callSaved=1`);
}


export async function createContactGroup(formData: FormData) {
  const member=await currentContext();
  const parsed=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(500).optional(),color:z.string().regex(/^#[0-9A-Fa-f]{6}$/)}).safeParse({name:formData.get("name"),description:formData.get("description")||"",color:formData.get("color")||"#6653E8"});
  if(!parsed.success) redirect("/contacts?groupError=invalid");
  try{await query("INSERT INTO contact_groups (id,company_id,name,description,color) VALUES ($1,$2,$3,$4,$5)",[randomUUID(),member.company_id,parsed.data.name,parsed.data.description||null,parsed.data.color]);}catch(error){console.error(error);redirect("/contacts?groupError=duplicate");}
  revalidatePath("/contacts");redirect("/contacts?groupCreated=1");
}
export async function deleteContactGroup(formData: FormData){const member=await currentContext();const groupId=String(formData.get("groupId")||"");await query("DELETE FROM contact_groups WHERE id=$1 AND company_id=$2",[groupId,member.company_id]);revalidatePath("/contacts");redirect("/contacts?groupDeleted=1");}
export async function updateContactGroups(formData: FormData){const member=await currentContext();const contactId=String(formData.get("contactId")||"");const groupIds=formData.getAll("groupIds").map(String);const contact=await query<{id:string}>("SELECT id FROM contacts WHERE id=$1 AND company_id=$2",[contactId,member.company_id]);if(!contact[0])redirect("/contacts");const valid=groupIds.length?await query<{id:string}>("SELECT id FROM contact_groups WHERE company_id=$1 AND id=ANY($2::text[])",[member.company_id,groupIds]):[];const client=await pool.connect();try{await client.query("BEGIN");await client.query("DELETE FROM contact_group_members WHERE contact_id=$1",[contactId]);for(const group of valid)await client.query("INSERT INTO contact_group_members (group_id,contact_id) VALUES ($1,$2)",[group.id,contactId]);await client.query("COMMIT");}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}revalidatePath(`/contacts/${contactId}`);revalidatePath("/contacts");redirect(`/contacts/${contactId}?groupsSaved=1`);}
