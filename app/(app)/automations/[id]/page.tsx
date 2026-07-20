import Link from "next/link";
import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { testAutomation, toggleAutomation } from "../actions";
import styles from "../automations.module.css";

export default async function AutomationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  const member = await currentContext();
  const { id } = await params;
  const feedback = await searchParams;

  const [automations, runs] = await Promise.all([
    query<any>(
      `
      SELECT *
      FROM automations
      WHERE id=$1 AND company_id=$2
      LIMIT 1
      `,
      [id, member.company_id],
    ),
    query<any>(
      `
      SELECT *
      FROM automation_runs
      WHERE automation_id=$1 AND company_id=$2
      ORDER BY started_at DESC
      LIMIT 20
      `,
      [id, member.company_id],
    ),
  ]);

  const automation = automations[0];
  if (!automation) notFound();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/automations">← Retour</Link>
          <h1>{automation.name}</h1>
          <p>{automation.description || "Sans description"}</p>
        </div>

        <div className={styles.actions}>
          <form action={testAutomation}>
            <input name="automationId" type="hidden" value={automation.id} />
            <button className={styles.primaryButton} type="submit">
              Tester maintenant
            </button>
          </form>

          <form action={toggleAutomation}>
            <input name="automationId" type="hidden" value={automation.id} />
            <button className={styles.secondaryButton} type="submit">
              {automation.is_active ? "Désactiver" : "Activer"}
            </button>
          </form>
        </div>
      </header>

      {feedback.test && (
        <div
          className={`import-alert ${
            feedback.test === "success" ? "success" : "error"
          }`}
        >
          <strong>
            {feedback.test === "success"
              ? "Test terminé."
              : "Le test a échoué."}
          </strong>
          <span>Consultez l’historique ci-dessous.</span>
        </div>
      )}

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>Statut</span>
          <strong>{automation.is_active ? "Active" : "Inactive"}</strong>
        </article>
        <article className={styles.stat}>
          <span>Déclencheur</span>
          <strong>{automation.trigger_type}</strong>
        </article>
        <article className={styles.stat}>
          <span>Conditions</span>
          <strong>{automation.conditions?.length ?? 0}</strong>
        </article>
        <article className={styles.stat}>
          <span>Actions</span>
          <strong>{automation.actions?.length ?? 0}</strong>
        </article>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2>Configuration</h2>
            <p>Définition technique du workflow.</p>
          </div>
        </header>

        <div className={styles.form}>
          <label>
            Conditions
            <textarea
              readOnly
              value={JSON.stringify(automation.conditions, null, 2)}
            />
          </label>

          <label>
            Actions
            <textarea
              readOnly
              value={JSON.stringify(automation.actions, null, 2)}
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2>Historique d’exécution</h2>
            <p>{runs.length} exécution{runs.length > 1 ? "s" : ""}</p>
          </div>
        </header>

        <div className={styles.runList}>
          {runs.map((run) => (
            <div className={styles.run} key={run.id}>
              <strong>{run.status}</strong>
              <span>{run.error_message || "Aucune erreur"}</span>
              <small>{new Date(run.started_at).toLocaleString("fr-FR")}</small>
            </div>
          ))}

          {runs.length === 0 && (
            <div className={styles.empty}>Aucun test pour le moment.</div>
          )}
        </div>
      </section>
    </div>
  );
}
