"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

const eventTypes = [
  "MEETING",
  "CALL",
  "FOLLOW_UP",
  "DEADLINE",
  "PAYMENT",
  "CAMPAIGN",
  "OTHER",
] as const;

const statuses = ["PLANNED", "DONE", "CANCELLED"] as const;

const eventSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(3000).optional(),
  eventType: z.enum(eventTypes),
  status: z.enum(statuses),
  contactId: z.string().trim().optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  location: z.string().trim().max(300).optional(),
  reminderMinutes: z.coerce.number().int().min(0).max(10080),
});

export async function createCalendarEvent(formData: FormData) {
  const member = await currentContext();

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    eventType: formData.get("eventType") || "MEETING",
    status: "PLANNED",
    contactId: formData.get("contactId") || "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    location: formData.get("location") || "",
    reminderMinutes: formData.get("reminderMinutes") || 30,
  });

  if (!parsed.success) redirect("/calendar?error=invalid");

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);

  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt
  ) {
    redirect("/calendar?error=dates");
  }

  if (parsed.data.contactId) {
    const contact = await query<{ id: string }>(
      "SELECT id FROM contacts WHERE id=$1 AND company_id=$2 LIMIT 1",
      [parsed.data.contactId, member.company_id],
    );
    if (!contact[0]) redirect("/calendar?error=contact");
  }

  const eventId = randomUUID();

  await query(
    `
    INSERT INTO calendar_events (
      id, company_id, contact_id, assigned_user_id,
      title, description, event_type, status,
      start_at, end_at, location, reminder_minutes, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,'PLANNED',$8,$9,$10,$11,$12)
    `,
    [
      eventId,
      member.company_id,
      parsed.data.contactId || null,
      member.user_id,
      parsed.data.title,
      parsed.data.description || null,
      parsed.data.eventType,
      startAt.toISOString(),
      endAt.toISOString(),
      parsed.data.location || null,
      parsed.data.reminderMinutes,
      member.user_id,
    ],
  );

  if (parsed.data.contactId) {
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
        parsed.data.contactId,
        member.user_id,
        parsed.data.eventType,
        "Événement planifié",
        `${parsed.data.title} — ${startAt.toLocaleString("fr-FR")}`,
      ],
    );
    revalidatePath(`/contacts/${parsed.data.contactId}`);
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/calendar?created=1&event=${eventId}`);
}

export async function updateCalendarEvent(formData: FormData) {
  const member = await currentContext();
  const eventId = String(formData.get("eventId") ?? "");

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    eventType: formData.get("eventType") || "MEETING",
    status: formData.get("status") || "PLANNED",
    contactId: formData.get("contactId") || "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    location: formData.get("location") || "",
    reminderMinutes: formData.get("reminderMinutes") || 30,
  });

  if (!eventId || !parsed.success) {
    redirect(`/calendar/${eventId}?error=invalid`);
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    redirect(`/calendar/${eventId}?error=dates`);
  }

  const updated = await query<{ id: string }>(
    `
    UPDATE calendar_events
    SET contact_id=$3,
        title=$4,
        description=$5,
        event_type=$6,
        status=$7,
        start_at=$8,
        end_at=$9,
        location=$10,
        reminder_minutes=$11,
        updated_at=NOW()
    WHERE id=$1 AND company_id=$2
    RETURNING id
    `,
    [
      eventId,
      member.company_id,
      parsed.data.contactId || null,
      parsed.data.title,
      parsed.data.description || null,
      parsed.data.eventType,
      parsed.data.status,
      startAt.toISOString(),
      endAt.toISOString(),
      parsed.data.location || null,
      parsed.data.reminderMinutes,
    ],
  );

  if (!updated[0]) redirect("/calendar");

  revalidatePath("/calendar");
  revalidatePath(`/calendar/${eventId}`);
  revalidatePath("/dashboard");
  redirect(`/calendar/${eventId}?saved=1`);
}

export async function completeCalendarEvent(formData: FormData) {
  const member = await currentContext();
  const eventId = String(formData.get("eventId") ?? "");

  await query(
    `
    UPDATE calendar_events
    SET status='DONE', updated_at=NOW()
    WHERE id=$1 AND company_id=$2
    `,
    [eventId, member.company_id],
  );

  revalidatePath("/calendar");
  revalidatePath(`/calendar/${eventId}`);
  revalidatePath("/dashboard");
  redirect(`/calendar/${eventId}?done=1`);
}

export async function deleteCalendarEvent(formData: FormData) {
  const member = await currentContext();
  const eventId = String(formData.get("eventId") ?? "");

  await query(
    "DELETE FROM calendar_events WHERE id=$1 AND company_id=$2",
    [eventId, member.company_id],
  );

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/calendar?deleted=1");
}
