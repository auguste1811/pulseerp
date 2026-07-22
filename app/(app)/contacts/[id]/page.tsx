import Link from "next/link";
import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../../components/icons";
import {
  addContactActivity,
  addContactNote,
  deleteContact,
  updateContact,
  scheduleContactMeeting,
} from "../actions";

const statuses: Record<string, string> = {
  PROSPECT: "Prospect",
  CONTACTED: "Contacté",
  MEETING: "Rendez-vous",
  NEGOTIATION: "Négociation",
  CUSTOMER: "Client",
  LOST: "Perdu",
};

const activityLabels: Record<string, string> = {
  CREATED: "Création",
  UPDATED: "Modification",
  STAGE_CHANGED: "Pipeline",
  NOTE: "Note",
  CALL: "Appel",
  EMAIL: "Email",
  MEETING: "Rendez-vous",
  FOLLOW_UP: "Relance",
};

export default async function ContactDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const member = await currentContext();
  const { id } = await params;
  const feedback = await searchParams;

  const [contacts, notes, activities, nextMeetings] = await Promise.all([
    query<any>(
      `
      SELECT c.*, u.first_name AS assigned_first_name, u.last_name AS assigned_last_name
      FROM contacts c
      LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE c.id = $1 AND c.company_id = $2
      LIMIT 1
      `,
      [id, member.company_id],
    ),
    query<any>(
      `
      SELECT n.*, u.first_name, u.last_name
      FROM contact_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.contact_id = $1 AND n.company_id = $2
      ORDER BY n.created_at DESC
      `,
      [id, member.company_id],
    ),
    query<any>(
      `
      SELECT a.*, u.first_name, u.last_name
      FROM contact_activities a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.contact_id = $1 AND a.company_id = $2
      ORDER BY a.created_at DESC
      LIMIT 100
      `,
      [id, member.company_id],
    ),
    query<any>(
      `
      SELECT id, title, start_at, end_at, location
      FROM calendar_events
      WHERE contact_id=$1
        AND company_id=$2
        AND status='PLANNED'
        AND start_at>=NOW()
      ORDER BY start_at
      LIMIT 1
      `,
      [id, member.company_id],
    ),
  ]);

  const contact = contacts[0];
  const nextMeeting = nextMeetings[0];
  if (!contact) notFound();

  return (
    <>
      <section className="page-heading contact-detail-heading">
        <div>
          <Link className="back-link" href="/contacts">← Retour au CRM</Link>
          <p className="eyebrow">Fiche client</p>
          <h1>{contact.first_name} {contact.last_name}</h1>
          <p>{contact.company_name || contact.email || "Contact sans entreprise"}</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-action" href="/contacts/pipeline">Pipeline</Link>
          <span className={`status-pill ${contact.status.toLowerCase()}`}>
            {statuses[contact.status] ?? contact.status}
          </span>
        </div>
      </section>

      {(feedback.saved || feedback.noteAdded || feedback.activityAdded || feedback.meetingCreated) && (
        <div className="import-alert success">
          <strong>Enregistré.</strong>
          <span>Les informations de la fiche client ont été mises à jour.</span>
        </div>
      )}

      <section className="contact-profile-grid">
        <aside className="dashboard-panel contact-profile-card">
          <span className="large-contact-avatar">
            {contact.first_name[0]}{contact.last_name[0]}
          </span>
          <h2>{contact.first_name} {contact.last_name}</h2>
          <p>{contact.company_name || "Particulier"}</p>
          <strong className="contact-lifetime-value">{euro(Number(contact.value))}</strong>
          <small>Valeur commerciale estimée</small>

          <div className="contact-quick-info">
            <div><span>Email</span><strong>{contact.email || "Non renseigné"}</strong></div>
            <div><span>Téléphone</span><strong>{contact.phone || "Non renseigné"}</strong></div>
            <div><span>Source</span><strong>{contact.source || "Non renseignée"}</strong></div>
            <div><span>Priorité</span><strong>{contact.priority}</strong></div>
          </div>

          {contact.tags?.length > 0 && (
            <div className="contact-tags">
              {contact.tags.map((tag: string) => <span key={tag}>{tag}</span>)}
            </div>
          )}
        </aside>

        <div className="contact-detail-main">
          <article className="dashboard-panel">
            <div className="panel-header">
              <div><h2>Informations générales</h2><p>Coordonnées et informations administratives</p></div>
            </div>
            <form action={updateContact} className="premium-form">
              <input type="hidden" name="contactId" value={contact.id} />
              <div className="form-row">
                <label>Prénom<input name="firstName" defaultValue={contact.first_name} required /></label>
                <label>Nom<input name="lastName" defaultValue={contact.last_name} required /></label>
              </div>
              <div className="form-row">
                <label>Entreprise<input name="companyName" defaultValue={contact.company_name ?? ""} /></label>
                <label>Source
                  <select name="source" defaultValue={contact.source ?? ""}>
                    <option value="">Non renseignée</option>
                    <option value="Ads">Ads</option>
                    <option value="Clipping">Clipping</option>
                    <option value="UGC / Affilié">UGC / Affilié</option>
                    <option value="Influenceur">Influenceur</option>
                    <option value="Organique">Organique</option>
                    <option value="Site comparatif">Site comparatif</option>
                    <option value={contact.source ?? ""}>
                      {contact.source && !["Ads","Clipping","UGC / Affilié","Influenceur","Organique","Site comparatif"].includes(contact.source)
                        ? contact.source
                        : "Autre"}
                    </option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Email<input name="email" type="email" defaultValue={contact.email ?? ""} /></label>
                <label>Téléphone<input name="phone" defaultValue={contact.phone ?? ""} /></label>
              </div>
              <label>Adresse<input name="address" defaultValue={contact.address ?? ""} /></label>
              <div className="form-row">
                <label>SIRET<input name="siret" defaultValue={contact.siret ?? ""} /></label>
                <label>N° TVA<input name="vatNumber" defaultValue={contact.vat_number ?? ""} /></label>
              </div>
              <div className="form-row">
                <label>Étape
                  <select name="status" defaultValue={contact.status}>
                    {Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <label>Priorité
                  <select name="priority" defaultValue={contact.priority}>
                    <option value="LOW">Basse</option>
                    <option value="MEDIUM">Moyenne</option>
                    <option value="HIGH">Haute</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Valeur estimée (€)<input name="value" type="number" min="0" defaultValue={Number(contact.value)} /></label>
                <label>Tags<input name="tags" defaultValue={(contact.tags ?? []).join(", ")} placeholder="VIP, relance, premium" /></label>
              </div>
              <button className="primary-action" type="submit">Enregistrer les modifications</button>
            </form>
          </article>


          <article className="dashboard-panel contact-next-meeting-card">
            <div className="panel-header">
              <div>
                <h2>Prochain rendez-vous</h2>
                <p>
                  Le rendez-vous créé ici est ajouté automatiquement au calendrier.
                </p>
              </div>
            </div>

            {nextMeeting && (
              <div className="next-meeting-summary">
                <span>Prochain</span>
                <strong>{nextMeeting.title}</strong>
                <small>
                  {new Date(nextMeeting.start_at).toLocaleString("fr-FR")}
                  {nextMeeting.location ? ` · ${nextMeeting.location}` : ""}
                </small>
                <Link href={`/calendar/${nextMeeting.id}`}>Ouvrir dans le calendrier →</Link>
              </div>
            )}

            {feedback.meetingError && (
              <div className="import-alert error">
                <strong>Rendez-vous non créé.</strong>
                <span>Vérifiez la date et les informations saisies.</span>
              </div>
            )}

            <form action={scheduleContactMeeting} className="premium-form">
              <input type="hidden" name="contactId" value={contact.id} />
              <label>
                Objet
                <input
                  name="title"
                  defaultValue={`Rendez-vous — ${contact.first_name} ${contact.last_name}`}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  Date et heure
                  <input name="startAt" type="datetime-local" required />
                </label>
                <label>
                  Durée
                  <select name="durationMinutes" defaultValue="60">
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 heure</option>
                    <option value="90">1 h 30</option>
                    <option value="120">2 heures</option>
                  </select>
                </label>
              </div>
              <label>
                Lieu
                <input name="location" placeholder="Téléphone, visio, adresse..." />
              </label>
              <label>
                Description
                <textarea name="description" placeholder="Objectifs et informations du rendez-vous..." />
              </label>
              <button className="primary-action" type="submit">
                Planifier et ajouter au calendrier
              </button>
            </form>
          </article>

          <section className="contact-workspace-grid">
            <article className="dashboard-panel">
              <div className="panel-header"><div><h2>Notes internes</h2><p>Informations visibles par votre équipe</p></div></div>
              <form action={addContactNote} className="note-form">
                <input type="hidden" name="contactId" value={contact.id} />
                <textarea name="content" placeholder="Ajouter une note importante..." required />
                <button className="primary-action" type="submit">Ajouter la note</button>
              </form>
              <div className="notes-list">
                {notes.map((note) => (
                  <div className="note-card" key={note.id}>
                    <p>{note.content}</p>
                    <small>{note.first_name} {note.last_name} · {new Date(note.created_at).toLocaleString("fr-FR")}</small>
                  </div>
                ))}
                {notes.length === 0 && <div className="empty-state">Aucune note pour le moment.</div>}
              </div>
            </article>

            <article className="dashboard-panel">
              <div className="panel-header"><div><h2>Nouvelle activité</h2><p>Appel, email, rendez-vous ou relance</p></div></div>
              <form action={addContactActivity} className="premium-form">
                <input type="hidden" name="contactId" value={contact.id} />
                <label>Type
                  <select name="type">
                    <option value="CALL">Appel</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Rendez-vous</option>
                    <option value="FOLLOW_UP">Relance</option>
                  </select>
                </label>
                <label>Titre<input name="title" placeholder="Appel de qualification" required /></label>
                <label>Description<input name="description" placeholder="Compte-rendu rapide..." /></label>
                <button className="secondary-action" type="submit">Enregistrer l’activité</button>
              </form>
            </article>
          </section>

          <article className="dashboard-panel">
            <div className="panel-header"><div><h2>Historique</h2><p>Chronologie complète du contact</p></div></div>
            <div className="activity-timeline">
              {activities.map((activity) => (
                <div className="timeline-item" key={activity.id}>
                  <span className={`timeline-icon ${activity.type.toLowerCase()}`}>
                    <Icon name={activity.type === "CALL" ? "crm" : activity.type === "EMAIL" ? "documents" : "clock"} size={15} />
                  </span>
                  <div>
                    <div className="timeline-title">
                      <strong>{activity.title}</strong>
                      <span>{activityLabels[activity.type] ?? activity.type}</span>
                    </div>
                    {activity.description && <p>{activity.description}</p>}
                    <small>
                      {activity.first_name ? `${activity.first_name} ${activity.last_name} · ` : ""}
                      {new Date(activity.created_at).toLocaleString("fr-FR")}
                    </small>
                  </div>
                </div>
              ))}
              {activities.length === 0 && <div className="empty-state">Aucune activité enregistrée.</div>}
            </div>
          </article>

          <article className="dashboard-panel danger-zone">
            <div>
              <h2>Supprimer le contact</h2>
              <p>Cette action supprime définitivement la fiche, ses notes et son historique.</p>
            </div>
            <form action={deleteContact}>
              <input type="hidden" name="contactId" value={contact.id} />
              <button className="danger-action" type="submit">Supprimer définitivement</button>
            </form>
          </article>
        </div>
      </section>
    </>
  );
}
