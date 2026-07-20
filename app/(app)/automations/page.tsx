import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { Icon } from "../components/icons";
import {
  deleteAutomation,
  installTemplate,
  toggleAutomation,
} from "./actions";
import styles from "./automations.module.css";

const triggerLabels: Record<string, string> = {
  CONTACT_CREATED: "Nouveau contact",
  CONTACT_STATUS_CHANGED: "Statut CRM modifié",
  INVOICE_CREATED: "Facture créée",
  INVOICE_PAID: "Facture payée",
  INVOICE_OVERDUE: "Facture en retard",
  TASK_CREATED: "Tâche créée",
  TASK_COMPLETED: "Tâche terminée",
  DOCUMENT_UPLOADED: "Document ajouté",
  MANUAL: "Exécution manuelle",
};

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  const member = await currentContext();
  const feedback = await searchParams;

  const [automations, runs] = await Promise.all([
    query<any>(
      `
      SELECT *
      FROM automations
      WHERE company_id=$1
      ORDER BY created_at DESC
      `,
      [member.company_id],
    ),
    query<any>(
      `
      SELECT r.*, a.name AS automation_name
      FROM automation_runs r
      JOIN automations a ON a.id=r.automation_id
      WHERE r.company_id=$1
      ORDER BY r.started_at DESC
      LIMIT 8
      `,
      [member.company_id],
    ),
  ]);

  const active = automations.filter((item) => item.is_active).length;
  const errors = automations.filter(
    (item) => item.last_run_status === "ERROR",
  ).length;
  const successRuns = runs.filter((item) => item.status === "SUCCESS").length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Centre d’automatisation</h1>
          <p>
            Automatisez les actions répétitives de votre CRM, de vos factures
            et de vos tâches.
          </p>
        </div>

        <Link className={styles.primaryButton} href="/automations/new">
          <Icon name="plus" size={17} />
          Nouvelle automatisation
        </Link>
      </header>

      {(feedback.saved ||
        feedback.deleted ||
        feedback.templateInstalled) && (
        <div className="import-alert success">
          <strong>Automatisation mise à jour.</strong>
          <span>Les modifications ont été enregistrées.</span>
        </div>
      )}

      {feedback.error && (
        <div className="import-alert error">
          <strong>Action impossible.</strong>
          <span>Vérifiez la configuration du workflow.</span>
        </div>
      )}

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>Automatisations</span>
          <strong>{automations.length}</strong>
        </article>
        <article className={styles.stat}>
          <span>Actives</span>
          <strong>{active}</strong>
        </article>
        <article className={styles.stat}>
          <span>Erreurs récentes</span>
          <strong>{errors}</strong>
        </article>
        <article className={styles.stat}>
          <span>Exécutions réussies</span>
          <strong>{successRuns}</strong>
        </article>
      </section>

      <section className={styles.layout}>
        <main className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Vos workflows</h2>
              <p>{automations.length} automatisation{automations.length > 1 ? "s" : ""}</p>
            </div>
          </header>

          <div className={styles.list}>
            {automations.map((automation) => (
              <div className={styles.row} key={automation.id}>
                <span className={styles.icon}>
                  <Icon name="sparkles" size={20} />
                </span>

                <div className={styles.main}>
                  <Link href={`/automations/${automation.id}`}>
                    <strong>{automation.name}</strong>
                  </Link>
                  <small>{automation.description || "Sans description"}</small>
                </div>

                <div className={styles.trigger}>
                  <span>Déclencheur</span>
                  <strong>
                    {triggerLabels[automation.trigger_type] ??
                      automation.trigger_type}
                  </strong>
                </div>

                <div className={styles.status}>
                  <span>Statut</span>
                  <strong
                    className={
                      automation.is_active
                        ? styles.active
                        : styles.inactive
                    }
                  >
                    {automation.is_active ? "Active" : "Désactivée"}
                  </strong>
                </div>

                <div className={styles.lastRun}>
                  <span>Dernière exécution</span>
                  <strong>
                    {automation.last_run_at
                      ? new Date(automation.last_run_at).toLocaleString("fr-FR")
                      : "Jamais"}
                  </strong>
                </div>

                <div className={styles.actions}>
                  <form action={toggleAutomation}>
                    <input
                      name="automationId"
                      type="hidden"
                      value={automation.id}
                    />
                    <button className={styles.secondaryButton} type="submit">
                      {automation.is_active ? "Désactiver" : "Activer"}
                    </button>
                  </form>

                  <form action={deleteAutomation}>
                    <input
                      name="automationId"
                      type="hidden"
                      value={automation.id}
                    />
                    <button className={styles.dangerButton} type="submit">
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}

            {automations.length === 0 && (
              <div className={styles.empty}>
                Créez votre première automatisation ou installez un modèle.
              </div>
            )}
          </div>
        </main>

        <aside className={styles.sidebar}>
          <section className={styles.card}>
            <header className={styles.cardHeader}>
              <div>
                <h2>Modèles prêts à l’emploi</h2>
                <p>Installez un workflow en un clic.</p>
              </div>
            </header>

            <div className={styles.templateList}>
              {[
                [
                  "WELCOME_CLIENT",
                  "Bienvenue nouveau client",
                  "Crée une tâche d’onboarding quand un prospect devient client.",
                ],
                [
                  "PAID_INVOICE",
                  "Notification facture payée",
                  "Notifie automatiquement le responsable.",
                ],
                [
                  "BIG_INVOICE",
                  "Suivi grosse facture",
                  "Crée une tâche pour les factures supérieures à 2 000 €.",
                ],
              ].map(([value, title, description]) => (
                <article className={styles.template} key={value}>
                  <strong>{title}</strong>
                  <p>{description}</p>
                  <form action={installTemplate}>
                    <input name="template" type="hidden" value={value} />
                    <button type="submit">Installer</button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2>Historique récent</h2>
            <p>Dernières exécutions du moteur.</p>
          </div>
        </header>

        <div className={styles.runList}>
          {runs.map((run) => (
            <div className={styles.run} key={run.id}>
              <strong>{run.automation_name}</strong>
              <span
                className={
                  run.status === "SUCCESS"
                    ? styles.active
                    : run.status === "ERROR"
                      ? styles.error
                      : styles.inactive
                }
              >
                {run.status}
              </span>
              <small>
                {new Date(run.started_at).toLocaleString("fr-FR")}
              </small>
            </div>
          ))}

          {runs.length === 0 && (
            <div className={styles.empty}>Aucune exécution enregistrée.</div>
          )}
        </div>
      </section>
    </div>
  );
}
