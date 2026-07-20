import { randomUUID } from "node:crypto";
import { pool, query } from "@/lib/db";

export type AutomationTrigger =
  | "CONTACT_CREATED"
  | "CONTACT_STATUS_CHANGED"
  | "INVOICE_CREATED"
  | "INVOICE_PAID"
  | "INVOICE_OVERDUE"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "DOCUMENT_UPLOADED"
  | "MANUAL";

type AutomationAction =
  | {
      type: "CREATE_TASK";
      config: {
        title: string;
        priority?: string;
        dueInDays?: number;
        assignedUserId?: string;
      };
    }
  | {
      type: "CREATE_NOTIFICATION";
      config: {
        title: string;
        message: string;
        userId?: string;
      };
    }
  | {
      type: "ADD_CONTACT_NOTE";
      config: {
        content: string;
      };
    }
  | {
      type: "UPDATE_CONTACT_STATUS";
      config: {
        status: string;
      };
    }
  | {
      type: "WEBHOOK";
      config: {
        url: string;
      };
    };

type Condition = {
  field: string;
  operator:
    | "EQUALS"
    | "NOT_EQUALS"
    | "GREATER_THAN"
    | "LESS_THAN"
    | "CONTAINS";
  value: string | number | boolean;
};

function getValue(payload: Record<string, any>, path: string): any {
  return path.split(".").reduce((value, key) => value?.[key], payload);
}

function evaluateCondition(
  condition: Condition,
  payload: Record<string, any>,
): boolean {
  const actual = getValue(payload, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "EQUALS":
      return String(actual) === String(expected);
    case "NOT_EQUALS":
      return String(actual) !== String(expected);
    case "GREATER_THAN":
      return Number(actual) > Number(expected);
    case "LESS_THAN":
      return Number(actual) < Number(expected);
    case "CONTAINS":
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected).toLowerCase());
    default:
      return false;
  }
}

function interpolate(
  template: string,
  payload: Record<string, any>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, rawPath) => {
    const value = getValue(payload, String(rawPath).trim());
    return value === undefined || value === null ? "" : String(value);
  });
}

async function executeAction(
  companyId: string,
  actorId: string | null,
  action: AutomationAction,
  payload: Record<string, any>,
): Promise<string> {
  switch (action.type) {
    case "CREATE_TASK": {
      const dueDate = new Date();
      dueDate.setDate(
        dueDate.getDate() + Number(action.config.dueInDays ?? 0),
      );

      await query(
        `
        INSERT INTO tasks (
          id, company_id, title, status, priority,
          due_date, assigned_user_id
        )
        VALUES ($1,$2,$3,'TODO',$4,$5,$6)
        `,
        [
          randomUUID(),
          companyId,
          interpolate(action.config.title, payload),
          action.config.priority ?? "MEDIUM",
          dueDate.toISOString().slice(0, 10),
          action.config.assignedUserId || null,
        ],
      );

      return "Tâche créée.";
    }

    case "CREATE_NOTIFICATION": {
      const userId = action.config.userId || actorId;
      if (!userId) return "Notification ignorée : aucun destinataire.";

      await query(
        `
        INSERT INTO notifications (
          id, company_id, user_id, title, message, type
        )
        VALUES ($1,$2,$3,$4,$5,'AUTOMATION')
        `,
        [
          randomUUID(),
          companyId,
          userId,
          interpolate(action.config.title, payload),
          interpolate(action.config.message, payload),
        ],
      );

      return "Notification créée.";
    }

    case "ADD_CONTACT_NOTE": {
      const contactId = payload.contact?.id || payload.contactId;
      if (!contactId || !actorId) {
        return "Note ignorée : contact ou auteur manquant.";
      }

      await query(
        `
        INSERT INTO contact_notes (
          id, company_id, contact_id, author_id, content
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          randomUUID(),
          companyId,
          contactId,
          actorId,
          interpolate(action.config.content, payload),
        ],
      );

      return "Note CRM ajoutée.";
    }

    case "UPDATE_CONTACT_STATUS": {
      const contactId = payload.contact?.id || payload.contactId;
      if (!contactId) return "Statut ignoré : contact manquant.";

      await query(
        `
        UPDATE contacts
        SET status=$3, updated_at=NOW()
        WHERE id=$1 AND company_id=$2
        `,
        [contactId, companyId, action.config.status],
      );

      return "Statut CRM mis à jour.";
    }

    case "WEBHOOK": {
      const response = await fetch(action.config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Webhook HTTP ${response.status}`);
      }

      return "Webhook envoyé.";
    }

    default:
      return "Action inconnue.";
  }
}

export async function runAutomation(
  automationId: string,
  companyId: string,
  payload: Record<string, any>,
  actorId: string | null,
) {
  const automations = await query<any>(
    `
    SELECT *
    FROM automations
    WHERE id=$1 AND company_id=$2
    LIMIT 1
    `,
    [automationId, companyId],
  );

  const automation = automations[0];
  if (!automation) throw new Error("Automatisation introuvable.");

  const runId = randomUUID();
  const logs: Array<{
    at: string;
    level: "INFO" | "SUCCESS" | "ERROR";
    message: string;
  }> = [];

  await query(
    `
    INSERT INTO automation_runs (
      id, company_id, automation_id, trigger_payload, status
    )
    VALUES ($1,$2,$3,$4,'RUNNING')
    `,
    [runId, companyId, automationId, JSON.stringify(payload)],
  );

  try {
    const conditions = Array.isArray(automation.conditions)
      ? automation.conditions
      : [];
    const actions = Array.isArray(automation.actions)
      ? automation.actions
      : [];

    logs.push({
      at: new Date().toISOString(),
      level: "INFO",
      message: "Déclencheur reçu.",
    });

    for (const condition of conditions) {
      const passed = evaluateCondition(condition, payload);
      logs.push({
        at: new Date().toISOString(),
        level: passed ? "SUCCESS" : "ERROR",
        message: passed
          ? `Condition validée : ${condition.field}`
          : `Condition non validée : ${condition.field}`,
      });

      if (!passed) {
        await query(
          `
          UPDATE automation_runs
          SET status='SKIPPED',
              logs=$2,
              finished_at=NOW()
          WHERE id=$1
          `,
          [runId, JSON.stringify(logs)],
        );

        await query(
          `
          UPDATE automations
          SET last_run_at=NOW(),
              last_run_status='SKIPPED',
              updated_at=NOW()
          WHERE id=$1
          `,
          [automationId],
        );

        return { runId, status: "SKIPPED", logs };
      }
    }

    for (const action of actions as AutomationAction[]) {
      const message = await executeAction(
        companyId,
        actorId,
        action,
        payload,
      );

      logs.push({
        at: new Date().toISOString(),
        level: "SUCCESS",
        message,
      });
    }

    await query(
      `
      UPDATE automation_runs
      SET status='SUCCESS',
          logs=$2,
          finished_at=NOW()
      WHERE id=$1
      `,
      [runId, JSON.stringify(logs)],
    );

    await query(
      `
      UPDATE automations
      SET last_run_at=NOW(),
          last_run_status='SUCCESS',
          updated_at=NOW()
      WHERE id=$1
      `,
      [automationId],
    );

    return { runId, status: "SUCCESS", logs };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    logs.push({
      at: new Date().toISOString(),
      level: "ERROR",
      message,
    });

    await query(
      `
      UPDATE automation_runs
      SET status='ERROR',
          logs=$2,
          error_message=$3,
          finished_at=NOW()
      WHERE id=$1
      `,
      [runId, JSON.stringify(logs), message],
    );

    await query(
      `
      UPDATE automations
      SET last_run_at=NOW(),
          last_run_status='ERROR',
          updated_at=NOW()
      WHERE id=$1
      `,
      [automationId],
    );

    throw error;
  }
}

export async function emitAutomationEvent(
  companyId: string,
  triggerType: AutomationTrigger,
  payload: Record<string, any>,
  actorId: string | null,
) {
  const automations = await query<{ id: string }>(
    `
    SELECT id
    FROM automations
    WHERE company_id=$1
      AND trigger_type=$2
      AND is_active=TRUE
    ORDER BY created_at
    `,
    [companyId, triggerType],
  );

  for (const automation of automations) {
    try {
      await runAutomation(
        automation.id,
        companyId,
        payload,
        actorId,
      );
    } catch (error) {
      console.error(
        `Automation ${automation.id} failed for ${triggerType}:`,
        error,
      );
    }
  }
}
