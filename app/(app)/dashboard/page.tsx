import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../components/icons";
import { GoalCard } from "./components/goal-card";
import { KpiCard } from "./components/kpi-card";
import { RevenueChart } from "./components/revenue-chart";

function statusLabel(value: string) {
  return {
    PAID: "Payé",
    PENDING: "En attente",
    OVERDUE: "Impayé",
    DONE: "Terminée",
    TODO: "À faire",
    IN_PROGRESS: "En cours",
    WAITING: "En attente",
  }[value] ?? value;
}

export default async function Dashboard() {
  const member = await currentContext();

  const [transactions, contactsCount, tasks, upcomingEvents] = await Promise.all([
    query<any>(
      "SELECT * FROM transactions WHERE company_id=$1 ORDER BY date DESC, created_at DESC",
      [member.company_id],
    ),
    query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM contacts WHERE company_id=$1",
      [member.company_id],
    ),
    query<any>(
      "SELECT * FROM tasks WHERE company_id=$1 ORDER BY created_at DESC",
      [member.company_id],
    ),
    query<any>(
      `
      SELECT *
      FROM calendar_events
      WHERE company_id=$1
        AND start_at >= NOW()
        AND status='PLANNED'
      ORDER BY start_at
      LIMIT 4
      `,
      [member.company_id],
    ),
  ]);

  const revenue = transactions
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + Number(item.amount_excluding_tax), 0);

  const expenses = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + Number(item.amount_excluding_tax), 0);

  const profit = revenue - expenses;
  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const target = Math.max(10000, Math.ceil((revenue * 1.45) / 500) * 500);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Vue d’ensemble</p>
          <h1>Bonjour {member.first_name} <span>👋</span></h1>
          <p>Voici les indicateurs essentiels de votre entreprise aujourd’hui.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-action" type="button">Exporter</button>
          <Link className="primary-action" href="/transactions">
            <Icon name="plus" size={17} />
            Nouvelle opération
          </Link>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Chiffre d’affaires"
          value={euro(revenue)}
          trend={12.8}
          trendLabel="vs. mois dernier"
          icon="revenue"
          tone="purple"
        />
        <KpiCard
          label="Dépenses"
          value={euro(expenses)}
          trend={-4.1}
          trendLabel="vs. mois dernier"
          icon="wallet"
          tone="orange"
        />
        <KpiCard
          label="Bénéfice net"
          value={euro(profit)}
          trend={8.4}
          trendLabel="vs. mois dernier"
          icon="profit"
          tone="green"
        />
        <KpiCard
          label="Clients actifs"
          value={contactsCount[0]?.count ?? "0"}
          trend={6.2}
          trendLabel="nouveaux ce mois"
          icon="users"
          tone="blue"
        />
      </section>

      <section className="dashboard-main-grid">
        <RevenueChart />
        <GoalCard revenue={revenue} target={target} />
      </section>

      <section className="dashboard-panel dashboard-calendar-widget">
        <div className="panel-header">
          <div>
            <h2>Agenda à venir</h2>
            <p>Vos prochains rendez-vous et relances</p>
          </div>
          <Link className="text-link" href="/calendar">Ouvrir le calendrier</Link>
        </div>
        <div className="dashboard-event-list">
          {upcomingEvents.map((event) => (
            <Link href={`/calendar/${event.id}`} className="dashboard-event-item" key={event.id}>
              <span>{new Date(event.start_at).getDate()}</span>
              <div>
                <strong>{event.title}</strong>
                <small>{new Date(event.start_at).toLocaleString("fr-FR")}</small>
              </div>
              <em>{event.event_type}</em>
            </Link>
          ))}
          {upcomingEvents.length === 0 && (
            <div className="empty-state">Aucun événement planifié.</div>
          )}
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Dernières opérations</h2>
              <p>Les mouvements enregistrés récemment</p>
            </div>
            <Link className="text-link" href="/transactions">Tout afficher</Link>
          </div>

          <div className="data-table-wrap">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Opération</th>
                  <th>Catégorie</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className={`transaction-avatar ${item.type.toLowerCase()}`}>
                        {item.type === "INCOME" ? "↗" : "↘"}
                      </div>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.type === "INCOME" ? "Revenu" : "Dépense"}</small>
                      </div>
                    </td>
                    <td>{item.category || "Non classé"}</td>
                    <td>{new Date(item.date).toLocaleDateString("fr-FR")}</td>
                    <td><span className={`status-pill ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></td>
                    <td className={item.type === "INCOME" ? "amount-positive" : "amount-negative"}>
                      {item.type === "INCOME" ? "+" : "-"}{euro(Number(item.amount_including_tax))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && <div className="empty-state">Aucune opération enregistrée.</div>}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Tâches prioritaires</h2>
              <p>{openTasks.length} tâche{openTasks.length > 1 ? "s" : ""} à traiter</p>
            </div>
            <Link className="text-link" href="/tasks">Voir le Kanban</Link>
          </div>

          <div className="priority-list">
            {openTasks.slice(0, 5).map((task) => (
              <div className="priority-item" key={task.id}>
                <span className={`priority-checkbox ${task.status.toLowerCase()}`}>
                  {task.status === "DONE" ? <Icon name="check" size={14} /> : ""}
                </span>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    <Icon name="clock" size={13} />
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString("fr-FR")
                      : "Sans échéance"}
                  </small>
                </div>
                <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
              </div>
            ))}
            {openTasks.length === 0 && <div className="empty-state">Toutes les tâches sont terminées.</div>}
          </div>
        </article>
      </section>
    </>
  );
}
