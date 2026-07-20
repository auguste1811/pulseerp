import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { markAllNotificationsRead } from "./actions";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  const member = await currentContext();
  const feedback = await searchParams;

  const notifications = await query<any>(
    `
    SELECT *
    FROM notifications
    WHERE company_id=$1 AND user_id=$2
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [member.company_id, member.user_id],
  );

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Centre d’activité</p>
          <h1>Notifications</h1>
          <p>Retrouvez les alertes générées par PulseERP et vos workflows.</p>
        </div>
        <form action={markAllNotificationsRead}>
          <button className="secondary-action" type="submit">
            Tout marquer comme lu
          </button>
        </form>
      </section>

      {feedback.saved && (
        <div className="import-alert success">
          <strong>Notifications mises à jour.</strong>
          <span>Toutes les alertes ont été marquées comme lues.</span>
        </div>
      )}

      <section className="dashboard-panel">
        <div className="contact-list">
          {notifications.map((notification) => (
            <div className="contact-row" key={notification.id}>
              <span className="contact-avatar">
                {notification.is_read ? "✓" : "!"}
              </span>
              <div className="contact-main">
                <strong>{notification.title}</strong>
                <small>{notification.message}</small>
              </div>
              <span
                className={`status-pill ${
                  notification.is_read ? "customer" : "negotiation"
                }`}
              >
                {notification.is_read ? "Lue" : "Nouvelle"}
              </span>
              <strong className="contact-value">
                {new Date(notification.created_at).toLocaleString("fr-FR")}
              </strong>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="empty-state">Aucune notification.</div>
          )}
        </div>
      </section>
    </>
  );
}
