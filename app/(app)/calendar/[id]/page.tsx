import Link from "next/link";
import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  completeCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../actions";

export default async function CalendarEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string,string|undefined>>;
}) {
  const member = await currentContext();
  const { id } = await params;
  const feedback = await searchParams;

  const [events, contacts] = await Promise.all([
    query<any>(
      `
      SELECT e.*, c.first_name, c.last_name, c.company_name
      FROM calendar_events e
      LEFT JOIN contacts c ON c.id=e.contact_id
      WHERE e.id=$1 AND e.company_id=$2
      LIMIT 1
      `,
      [id, member.company_id],
    ),
    query<any>(
      `
      SELECT id, first_name, last_name, company_name
      FROM contacts
      WHERE company_id=$1
      ORDER BY last_name, first_name
      `,
      [member.company_id],
    ),
  ]);

  const event = events[0];
  if (!event) notFound();

  const localDateTime = (value: string | Date) => {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0,16);
  };

  return (
    <>
      <section className="page-heading">
        <div>
          <Link href="/calendar" className="back-link">← Retour au calendrier</Link>
          <p className="eyebrow">{event.event_type}</p>
          <h1>{event.title}</h1>
          <p>
            {new Date(event.start_at).toLocaleString("fr-FR")}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <span className={`status-pill ${event.status.toLowerCase()}`}>
          {event.status === "PLANNED" ? "Planifié" :
           event.status === "DONE" ? "Terminé" : "Annulé"}
        </span>
      </section>

      {(feedback.saved || feedback.done) && (
        <div className="import-alert success">
          <strong>Événement mis à jour.</strong>
          <span>Les modifications ont été enregistrées.</span>
        </div>
      )}

      <section className="event-detail-grid">
        <article className="dashboard-panel">
          <div className="panel-header">
            <div><h2>Modifier l’événement</h2><p>Dates, contact et informations pratiques.</p></div>
          </div>

          <form action={updateCalendarEvent} className="premium-form">
            <input type="hidden" name="eventId" value={event.id} />

            <label>Titre
              <input name="title" defaultValue={event.title} required />
            </label>

            <div className="form-row">
              <label>Type
                <select name="eventType" defaultValue={event.event_type}>
                  <option value="MEETING">Rendez-vous</option>
                  <option value="CALL">Appel</option>
                  <option value="FOLLOW_UP">Relance</option>
                  <option value="DEADLINE">Échéance</option>
                  <option value="PAYMENT">Paiement</option>
                  <option value="CAMPAIGN">Campagne</option>
                  <option value="OTHER">Autre</option>
                </select>
              </label>
              <label>Statut
                <select name="status" defaultValue={event.status}>
                  <option value="PLANNED">Planifié</option>
                  <option value="DONE">Terminé</option>
                  <option value="CANCELLED">Annulé</option>
                </select>
              </label>
            </div>

            <label>Contact CRM
              <select name="contactId" defaultValue={event.contact_id ?? ""}>
                <option value="">Aucun contact</option>
                {contacts.map((contact) => (
                  <option value={contact.id} key={contact.id}>
                    {contact.first_name} {contact.last_name}
                    {contact.company_name ? ` — ${contact.company_name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label>Début
                <input name="startAt" type="datetime-local" defaultValue={localDateTime(event.start_at)} required />
              </label>
              <label>Fin
                <input name="endAt" type="datetime-local" defaultValue={localDateTime(event.end_at)} required />
              </label>
            </div>

            <label>Lieu
              <input name="location" defaultValue={event.location ?? ""} />
            </label>

            <label>Rappel
              <select name="reminderMinutes" defaultValue={String(event.reminder_minutes)}>
                <option value="0">Aucun</option>
                <option value="10">10 minutes avant</option>
                <option value="30">30 minutes avant</option>
                <option value="60">1 heure avant</option>
                <option value="1440">1 jour avant</option>
              </select>
            </label>

            <label>Description
              <textarea name="description" defaultValue={event.description ?? ""} />
            </label>

            <button className="primary-action" type="submit">Enregistrer</button>
          </form>
        </article>

        <aside className="event-actions-column">
          <article className="dashboard-panel event-summary-card">
            <h2>Résumé</h2>
            <div><span>Début</span><strong>{new Date(event.start_at).toLocaleString("fr-FR")}</strong></div>
            <div><span>Fin</span><strong>{new Date(event.end_at).toLocaleString("fr-FR")}</strong></div>
            <div><span>Contact</span><strong>{event.company_name || (event.first_name ? `${event.first_name} ${event.last_name}` : "Aucun")}</strong></div>
            <div><span>Rappel</span><strong>{event.reminder_minutes ? `${event.reminder_minutes} min` : "Aucun"}</strong></div>
          </article>

          {event.status === "PLANNED" && (
            <article className="dashboard-panel">
              <form action={completeCalendarEvent}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="primary-action full-width" type="submit">
                  Marquer comme terminé
                </button>
              </form>
            </article>
          )}

          <article className="dashboard-panel danger-zone billing-danger">
            <div><h2>Supprimer</h2><p>Cette action est définitive.</p></div>
            <form action={deleteCalendarEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <button className="danger-action" type="submit">Supprimer</button>
            </form>
          </article>
        </aside>
      </section>
    </>
  );
}
