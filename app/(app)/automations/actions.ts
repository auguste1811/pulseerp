"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { runAutomation } from "@/lib/automation-engine";

const triggerTypes = [
  "CONTACT_CREATED",
  "CONTACT_STATUS_CHANGED",
  "INVOICE_CREATED",
  "INVOICE_PAID",
  "INVOICE_OVERDUE",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "DOCUMENT_UPLOADED",
  "MANUAL",
] as const;

const actionTypes = [
  "CREATE_TASK",
  "CREATE_NOTIFICATION",
  "ADD_CONTACT_NOTE",
  "UPDATE_CONTACT_STATUS",
  "WEBHOOK",
] as const;

export async function createAutomation(formData: FormData) {
  const member = await currentContext();

  const parsed = z.object({
    name: z.string().trim().min(2).max(180),
    description: z.string().trim().max(1000).optional(),
    triggerType: z.enum(triggerTypes),
    conditionField: z.string().trim().max(100).optional(),
    conditionOperator: z
      .enum([
        "EQUALS",
        "NOT_EQUALS",
        "GREATER_THAN",
        "LESS_THAN",
        "CONTAINS",
      ])
      .optional(),
    conditionValue: z.string().trim().max(300).optional(),
    actionType: z.enum(actionTypes),
    actionTitle: z.string().trim().max(300).optional(),
    actionMessage: z.string().trim().max(1500).optional(),
    actionPriority: z.string().trim().max(30).optional(),
    actionDueDays: z.coerce.number().int().min(0).max(365).optional(),
    actionStatus: z.string().trim().max(40).optional(),
    webhookUrl: z.union([z.literal(""), z.string().url()]).optional(),
  }).safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
    triggerType: formData.get("triggerType"),
    conditionField: formData.get("conditionField") || "",
    conditionOperator: formData.get("conditionOperator") || undefined,
    conditionValue: formData.get("conditionValue") || "",
    actionType: formData.get("actionType"),
    actionTitle: formData.get("actionTitle") || "",
    actionMessage: formData.get("actionMessage") || "",
    actionPriority: formData.get("actionPriority") || "MEDIUM",
    actionDueDays: formData.get("actionDueDays") || 0,
    actionStatus: formData.get("actionStatus") || "CONTACTED",
    webhookUrl: formData.get("webhookUrl") || "",
  });

  if (!parsed.success) redirect("/automations?error=invalid");

  const conditions =
    parsed.data.conditionField &&
    parsed.data.conditionOperator &&
    parsed.data.conditionValue !== ""
      ? [
          {
            field: parsed.data.conditionField,
            operator: parsed.data.conditionOperator,
            value: parsed.data.conditionValue,
          },
        ]
      : [];

  let action: Record<string, any>;

  switch (parsed.data.actionType) {
    case "CREATE_TASK":
      action = {
        type: "CREATE_TASK",
        config: {
          title:
            parsed.data.actionTitle ||
            "Action automatique pour {{contact.first_name}}",
          priority: parsed.data.actionPriority || "MEDIUM",
          dueInDays: parsed.data.actionDueDays || 0,
        },
      };
      break;

    case "CREATE_NOTIFICATION":
      action = {
        type: "CREATE_NOTIFICATION",
        config: {
          title:
            parsed.data.actionTitle || "Notification PulseERP",
          message:
            parsed.data.actionMessage ||
            "Une automatisation vient de s’exécuter.",
        },
      };
      break;

    case "ADD_CONTACT_NOTE":
      action = {
        type: "ADD_CONTACT_NOTE",
        config: {
          content:
            parsed.data.actionMessage ||
            "Note ajoutée automatiquement.",
        },
      };
      break;

    case "UPDATE_CONTACT_STATUS":
      action = {
        type: "UPDATE_CONTACT_STATUS",
        config: {
          status: parsed.data.actionStatus || "CONTACTED",
        },
      };
      break;

    case "WEBHOOK":
      action = {
        type: "WEBHOOK",
        config: {
          url: parsed.data.webhookUrl,
        },
      };
      break;
  }

  const automationId = randomUUID();

  await query(
    `
    INSERT INTO automations (
      id, company_id, name, description, trigger_type,
      trigger_config, conditions, actions, is_active, created_by
    )
    VALUES ($1,$2,$3,$4,$5,'{}',$6,$7,FALSE,$8)
    `,
    [
      automationId,
      member.company_id,
      parsed.data.name,
      parsed.data.description || null,
      parsed.data.triggerType,
      JSON.stringify(conditions),
      JSON.stringify([action]),
      member.user_id,
    ],
  );

  revalidatePath("/automations");
  redirect(`/automations/${automationId}?created=1`);
}

export async function toggleAutomation(formData: FormData) {
  const member = await currentContext();
  const automationId = String(formData.get("automationId") ?? "");

  await query(
    `
    UPDATE automations
    SET is_active=NOT is_active,
        updated_at=NOW()
    WHERE id=$1 AND company_id=$2
    `,
    [automationId, member.company_id],
  );

  revalidatePath("/automations");
  revalidatePath(`/automations/${automationId}`);
  redirect("/automations?saved=1");
}

export async function deleteAutomation(formData: FormData) {
  const member = await currentContext();
  const automationId = String(formData.get("automationId") ?? "");

  await query(
    "DELETE FROM automations WHERE id=$1 AND company_id=$2",
    [automationId, member.company_id],
  );

  revalidatePath("/automations");
  redirect("/automations?deleted=1");
}

export async function testAutomation(formData: FormData) {
  const member = await currentContext();
  const automationId = String(formData.get("automationId") ?? "");

  const payload = {
    contact: {
      id: null,
      first_name: "Client",
      last_name: "Test",
      email: "client.test@example.fr",
      status: "PROSPECT",
      value: 2500,
    },
    invoice: {
      id: "invoice-test",
      number: "FAC-TEST-0001",
      total: 2500,
      status: "PAID",
    },
    task: {
      id: "task-test",
      title: "Tâche test",
      status: "DONE",
    },
    manual: true,
  };

  try {
    await runAutomation(
      automationId,
      member.company_id,
      payload,
      member.user_id,
    );
  } catch {
    redirect(`/automations/${automationId}?test=error`);
  }

  revalidatePath("/automations");
  revalidatePath(`/automations/${automationId}`);
  redirect(`/automations/${automationId}?test=success`);
}

export async function installTemplate(formData: FormData) {
  const member = await currentContext();
  const template = String(formData.get("template") ?? "");

  const templates: Record<string, any> = {
    WELCOME_CLIENT: {
      name: "Bienvenue nouveau client",
      description:
        "Crée une tâche de suivi lorsqu’un contact devient client.",
      triggerType: "CONTACT_STATUS_CHANGED",
      conditions: [
        {
          field: "contact.status",
          operator: "EQUALS",
          value: "CUSTOMER",
        },
      ],
      actions: [
        {
          type: "CREATE_TASK",
          config: {
            title: "Appeler {{contact.first_name}} pour l’onboarding",
            priority: "HIGH",
            dueInDays: 1,
          },
        },
      ],
    },
    PAID_INVOICE: {
      name: "Notification facture payée",
      description:
        "Notifie le responsable lorsqu’une facture est marquée comme payée.",
      triggerType: "INVOICE_PAID",
      conditions: [],
      actions: [
        {
          type: "CREATE_NOTIFICATION",
          config: {
            title: "Facture payée",
            message:
              "La facture {{invoice.number}} de {{invoice.total}} € a été payée.",
          },
        },
      ],
    },
    BIG_INVOICE: {
      name: "Suivi grosse facture",
      description:
        "Crée une tâche quand une facture dépasse 2 000 €.",
      triggerType: "INVOICE_CREATED",
      conditions: [
        {
          field: "invoice.total",
          operator: "GREATER_THAN",
          value: 2000,
        },
      ],
      actions: [
        {
          type: "CREATE_TASK",
          config: {
            title: "Suivre la facture {{invoice.number}}",
            priority: "HIGH",
            dueInDays: 3,
          },
        },
      ],
    },
  };

  const selected = templates[template];
  if (!selected) redirect("/automations?error=template");

  await query(
    `
    INSERT INTO automations (
      id, company_id, name, description, trigger_type,
      trigger_config, conditions, actions, is_active, created_by
    )
    VALUES ($1,$2,$3,$4,$5,'{}',$6,$7,TRUE,$8)
    `,
    [
      randomUUID(),
      member.company_id,
      selected.name,
      selected.description,
      selected.triggerType,
      JSON.stringify(selected.conditions),
      JSON.stringify(selected.actions),
      member.user_id,
    ],
  );

  revalidatePath("/automations");
  redirect("/automations?templateInstalled=1");
}
