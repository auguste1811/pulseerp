import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { Icon } from "../components/icons";
import { createCalendarEvent } from "./actions";
import { MonthGrid } from "./month-grid";

const monthNames = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    created?: string;
    error?: string;
  }>;
}) {
  const member = await currentContext();
  const params = await searchParams;
  const now = new Date();

  const month = Math.min(11, Math.max(0, Number(params.month ?? now.getMonth())));
  const year = Math.min(2100, Math.max(2000, Number(params.year ?? now.getFullYear())));

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const [events, contacts, upcoming] = await Promise.all([
    query<any>(
      `
      SELECT e.*, c.first_name, c.last_name, c.company_name
      FROM calendar_events e
      LEFT JOIN contacts c ON c.id=e.contact_id
      WHERE e.company_id=$1
        AND e.start_at >= $2
        AND e.start_at < $3
      ORDER BY e.start_at
      `,
      [member.company_id, start.toISOString(), end.toISOString()],
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
    query<any>(
      `
      SELECT e.*, c.first_name, c.last_name, c.company_name
      FROM calendar_events e
      LEFT JOIN contacts c ON c.id=e.contact_id
      WHERE e.company_id=$1
        AND e.start_at >= NOW()
        AND e.status='PLANNED'
      ORDER BY e.start_at
      LIMIT 8
      `,
      [member.company_id],
    ),
  ]);

  const previous = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Organisation</p>
          <h1>Calendrier & relances</h1>
          <p>Centralisez vos rendez-vous, appels, échéances et suivis clients.</p>
        </div>
        <div className="calendar-nav">
          <Link
            className="secondary-action"
            href={`/calendar?month=${previous.getMonth()}&year=${previous.getFullYear()}`}
          >
            ←
          </Link>
          <strong>{monthNames[month]} {year}</strong>
          <Link
            className="secondary-action"
            href={`/calendar?month=${next.getMonth()}&year=${next.getFullYear()}`}
          >
            →
          </Link>
        </div>
      </section>

      {params.created && (
        <div className="import-alert success">
          <strong>Événement créé.</strong>
          <span>Il apparaît maintenant dans le calendrier.</span>
        </div>
      )}

      {params.error && (
        <div className="import-alert error">
          <strong>Création impossible.</strong>
          <span>Vérifiez les dates et les informations saisies.</span>
        </div>
      )}

      <section className="calendar-layout">
        <div className="calendar-main">
          <article className="dashboard-panel calendar-panel">
            <MonthGrid year={year} month={month} events={events} />
          </article>
        </div>

        <aside className="calendar-sidebar">
          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Nouvel événement</h2>
                <p>Planifiez une action ou une échéance.</p>
              </div>
            </div>

            <form action={createCalendarEvent} className="premium-form">
              <label>Titre
                <input name="title" placeholder="Rendez-vous commercial" required />
              </label>

              <label>Type
                <select name="eventType">
                  <option value="MEETING">Rendez-vous</option>
                  <option value="CALL">Appel</option>
                  <option value="FOLLOW_UP">Relance</option>
                  <option value="DEADLINE">Échéance</option>
                  <option value="PAYMENT">Paiement</option>
                  <option value="CAMPAIGN">Campagne</option>
                  <option value="OTHER">Autre</option>
                </select>
              </label>

              <label>Contact CRM
                <select name="contactId">
                  <option value="">Aucun contact</option>
                  {contacts.map((contact) => (
                    <option value={contact.id} key={contact.id}>
                      {contact.first_name} {contact.last_name}
                      {contact.company_name ? ` — ${contact.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>Début
                <input name="startAt" type="datetime-local" required />
              </label>

              <label>Fin
                <input name="endAt" type="datetime-local" required />
              </label>

              <label>Lieu
                <input name="location" placeholder="Visio, bureau, téléphone..." />
              </label>

              <label>Rappel
                <select name="reminderMinutes" defaultValue="30">
                  <option value="0">Aucun</option>
                  <option value="10">10 minutes avant</option>
                  <option value="30">30 minutes avant</option>
                  <option value="60">1 heure avant</option>
                  <option value="1440">1 jour avant</option>
                </select>
              </label>

              <label>Description
                <textarea name="description" placeholder="Informations complémentaires..." />
              </label>

              <button className="primary-action full-width" type="submit">
                <Icon name="plus" size={16} />
                Ajouter au calendrier
              </button>
            </form>
          </article>

          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>À venir</h2>
                <p>Les prochains événements planifiés.</p>
              </div>
            </div>

            <div className="upcoming-events">
              {upcoming.map((event) => (
                <Link href={`/calendar/${event.id}`} className="upcoming-event" key={event.id}>
                  <span className={`upcoming-type ${event.event_type.toLowerCase()}`}>
                    {new Date(event.start_at).getDate()}
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {new Date(event.start_at).toLocaleString("fr-FR", {
                        day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"
                      })}
                    </small>
                    {(event.company_name || event.first_name) && (
                      <em>{event.company_name || `${event.first_name} ${event.last_name}`}</em>
                    )}
                  </div>
                </Link>
              ))}
              {upcoming.length === 0 && (
                <div className="empty-state">Aucun événement à venir.</div>
              )}
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
