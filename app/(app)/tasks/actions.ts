"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  status: z.enum(["TODO", "IN_PROGRESS", "WAITING", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional(),
  assignedUserId: z.string().trim().optional(),
});

export async function createTask(formData: FormData) {
  const member = await currentContext();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    status: formData.get("status") || "TODO",
    priority: formData.get("priority") || "MEDIUM",
    dueDate: formData.get("dueDate") || "",
    assignedUserId: formData.get("assignedUserId") || "",
  });

  if (!parsed.success) {
    redirect("/tasks?error=invalid");
  }

  if (parsed.data.assignedUserId) {
    const assignee = await query<{ user_id: string }>(
      `
      SELECT user_id
      FROM company_members
      WHERE user_id=$1 AND company_id=$2
      LIMIT 1
      `,
      [parsed.data.assignedUserId, member.company_id],
    );

    if (!assignee[0]) {
      redirect("/tasks?error=assignee");
    }
  }

  await query(
    `
    INSERT INTO tasks (
      id, company_id, title, status, priority, due_date, assigned_user_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      randomUUID(),
      member.company_id,
      parsed.data.title,
      parsed.data.status,
      parsed.data.priority,
      parsed.data.dueDate || null,
      parsed.data.assignedUserId || null,
    ],
  );

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/tasks?created=1");
}
