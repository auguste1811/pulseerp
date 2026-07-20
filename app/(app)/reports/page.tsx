import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import styles from "./reports.module.css";

function periodStart(period: string): Date {
  const now = new Date();
  const start = new Date(now);

  if (period === "7d") start.setDate(now.getDate() - 7);
  else if (period === "year") start.setMonth(0, 1);
  else start.setDate(now.getDate() - 30);

  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const member = await currentContext();
  const params = await searchParams;
  const period = ["7d", "30d", "year"].includes(params.period ?? "")
    ? params.period!
    : "30d";
  const start = periodStart(period);

  const [transactions, contacts, documents, automations, runs] =
    await Promise.all([
      query<any>(
        `
        SELECT *
        FROM transactions
        WHERE company_id=$1 AND date >= $2
        ORDER BY date
        `,
        [member.company_id, start.toISOString().slice(0, 10)],
      ),
      query<any>(
        `
        SELECT status, value, created_at
        FROM contacts
        WHERE company_id=$1 AND created_at >= $2
        `,
        [member.company_id, start.toISOString()],
      ),
      query<any>(
        `
        SELECT document_type, status, total, issue_date
        FROM sales_documents
        WHERE company_id=$1 AND issue_date >= $2
        `,
        [member.company_id, start.toISOString().slice(0, 10)],
      ),
      query<any>(
        `
        SELECT id, is_active, last_run_status
        FROM automations
        WHERE company_id=$1
        `,
        [member.company_id],
      ),
      query<any>(
        `
        SELECT status, started_at
        FROM automation_runs
        WHERE company_id=$1 AND started_at >= $2
        `,
        [member.company_id, start.toISOString()],
      ),
    ]);

  const income = transactions
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + Number(item.amount_including_tax), 0);
  const expenses = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + Number(item.amount_including_tax), 0);
  const margin = income - expenses;
  const customers = contacts.filter((item) => item.status === "CUSTOMER").length;
  const conversion =
    contacts.length > 0 ? Math.round((customers / contacts.length) * 100) : 0;
  const invoiceTotal = documents
    .filter((item) => item.document_type === "INVOICE")
    .reduce((sum, item) => sum + Number(item.total), 0);
  const paidTotal = documents
    .filter(
      (item) =>
        item.document_type === "INVOICE" && item.status === "PAID",
    )
    .reduce((sum, item) => sum + Number(item.total), 0);

  const points = Array.from({ length: period === "7d" ? 7 : 12 }, (_, index) => {
    const value = transactions
      .filter((item) => item.type === "INCOME")
      .slice(index * 2, index * 2 + 2)
      .reduce((sum, item) => sum + Number(item.amount_including_tax), 0);
    return {
      label: period === "7d" ? `J${index + 1}` : `${index + 1}`,
      value,
    };
  });
  const maxPoint = Math.max(1, ...points.map((item) => item.value));

  const categories = Object.entries(
    transactions
      .filter((item) => item.type === "EXPENSE")
      .reduce<Record<string, number>>((acc, item) => {
        const category = item.category || "Autres";
        acc[category] = (acc[category] || 0) + Number(item.amount_including_tax);
        return acc;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const successRuns = runs.filter((item) => item.status === "SUCCESS").length;
  const automationSuccessRate =
    runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Rapports</h1>
          <p>Analysez les performances de votre entreprise en temps réel.</p>
        </div>

        <nav className={styles.period}>
          <Link
            className={period === "7d" ? styles.active : ""}
            href="/reports?period=7d"
          >
            7 jours
          </Link>
          <Link
            className={period === "30d" ? styles.active : ""}
            href="/reports?period=30d"
          >
            30 jours
          </Link>
          <Link
            className={period === "year" ? styles.active : ""}
            href="/reports?period=year"
          >
            Année
          </Link>
        </nav>
      </header>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>Chiffre d’affaires</span>
          <strong>{euro(income)}</strong>
          <em>{transactions.length} opération(s)</em>
        </article>
        <article className={styles.stat}>
          <span>Dépenses</span>
          <strong>{euro(expenses)}</strong>
          <em>{categories.length} catégorie(s)</em>
        </article>
        <article className={styles.stat}>
          <span>Marge estimée</span>
          <strong>{euro(margin)}</strong>
          <em>{income ? Math.round((margin / income) * 100) : 0} % du CA</em>
        </article>
        <article className={styles.stat}>
          <span>Factures encaissées</span>
          <strong>{euro(paidTotal)}</strong>
          <em>sur {euro(invoiceTotal)}</em>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Évolution du chiffre d’affaires</h2>
              <p>Répartition des revenus sur la période.</p>
            </div>
          </header>

          <div className={styles.chart}>
            {points.map((point) => (
              <div className={styles.barWrap} key={point.label}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${Math.max(4, (point.value / maxPoint) * 210)}px`,
                  }}
                  title={euro(point.value)}
                />
                <small>{point.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Répartition des dépenses</h2>
              <p>Principales catégories de coûts.</p>
            </div>
          </header>

          <div className={styles.breakdown}>
            {categories.slice(0, 6).map(([category, amount]) => (
              <div className={styles.breakdownRow} key={category}>
                <strong>{category}</strong>
                <span>{euro(amount)}</span>
                <div className={styles.progress}>
                  <i
                    style={{
                      width: `${
                        expenses > 0 ? Math.round((amount / expenses) * 100) : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <span>Aucune dépense enregistrée sur la période.</span>
            )}
          </div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Performance commerciale</h2>
              <p>Résumé du CRM et de la facturation.</p>
            </div>
          </header>

          <div className={styles.list}>
            <div className={styles.row}>
              <strong>Nouveaux contacts</strong>
              <span>{contacts.length}</span>
              <small>Période sélectionnée</small>
            </div>
            <div className={styles.row}>
              <strong>Nouveaux clients</strong>
              <span>{customers}</span>
              <small>{conversion} % de conversion</small>
            </div>
            <div className={styles.row}>
              <strong>Devis créés</strong>
              <span>
                {
                  documents.filter(
                    (item) => item.document_type === "QUOTE",
                  ).length
                }
              </span>
              <small>Documents commerciaux</small>
            </div>
            <div className={styles.row}>
              <strong>Factures créées</strong>
              <span>
                {
                  documents.filter(
                    (item) => item.document_type === "INVOICE",
                  ).length
                }
              </span>
              <small>{euro(invoiceTotal)}</small>
            </div>
          </div>
        </article>

        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2>Automatisation</h2>
              <p>Fiabilité du moteur de workflows.</p>
            </div>
          </header>

          <div className={styles.list}>
            <div className={styles.row}>
              <strong>Workflows actifs</strong>
              <span>{automations.filter((item) => item.is_active).length}</span>
              <small>sur {automations.length}</small>
            </div>
            <div className={styles.row}>
              <strong>Exécutions</strong>
              <span>{runs.length}</span>
              <small>Période sélectionnée</small>
            </div>
            <div className={styles.row}>
              <strong>Taux de réussite</strong>
              <span>{automationSuccessRate} %</span>
              <small>{successRuns} succès</small>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
