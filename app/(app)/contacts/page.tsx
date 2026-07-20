import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../components/icons";
import { createContact, importContactsCsv } from "./actions";

const statuses: Record<string, string> = {
  PROSPECT: "Prospect",
  CONTACTED: "Contacté",
  MEETING: "Rendez-vous",
  NEGOTIATION: "Négociation",
  CUSTOMER: "Client",
  LOST: "Perdu",
};

const importErrors: Record<string, string> = {
  file: "Aucun fichier CSV n’a été sélectionné.",
  size: "Le fichier doit faire moins de 2 Mo.",
  format: "Le fichier doit être au format CSV.",
  rows: "Le fichier est vide ou dépasse 5 000 lignes.",
  invalid: "Aucune ligne valide n’a été trouvée.",
  database: "L’import a échoué lors de l’enregistrement.",
};

export default async function Contacts({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    updated?: string;
    rejected?: string;
    importError?: string;
  }>;
}) {
  const member = await currentContext();
  const params = await searchParams;
  const rows = await query<any>(
    "SELECT * FROM contacts WHERE company_id=$1 ORDER BY created_at DESC",
    [member.company_id],
  );

  const importSucceeded =
    params.imported !== undefined || params.updated !== undefined;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">CRM Pro</p>
          <h1>Contacts et opportunités</h1>
          <p>Centralisez vos prospects, clients et opportunités commerciales.</p>
        </div>
        <div className="heading-actions">
          <a className="secondary-action" href="/contacts/pipeline">Voir le pipeline</a>
          <button className="primary-action" form="contact-form" type="submit">
            <Icon name="plus" size={17} /> Nouveau contact
          </button>
        </div>
      </section>

      <section className="crm-stats-grid">
        <div><span>Contacts</span><strong>{rows.length}</strong></div>
        <div><span>Prospects</span><strong>{rows.filter((row) => row.status === "PROSPECT").length}</strong></div>
        <div><span>Clients</span><strong>{rows.filter((row) => row.status === "CUSTOMER").length}</strong></div>
        <div><span>Pipeline</span><strong>{euro(rows.filter((row) => !["CUSTOMER","LOST"].includes(row.status)).reduce((sum, row) => sum + Number(row.value), 0))}</strong></div>
      </section>

      {importSucceeded && (
        <div className="import-alert success">
          <strong>Import terminé.</strong>
          <span>
            {params.imported ?? "0"} ajouté(s), {params.updated ?? "0"} mis à jour,
            {" "}{params.rejected ?? "0"} rejeté(s).
          </span>
        </div>
      )}

      {params.importError && (
        <div className="import-alert error">
          <strong>Import impossible.</strong>
          <span>{importErrors[params.importError] ?? "Vérifiez votre fichier CSV."}</span>
        </div>
      )}

      <section className="crm-import-panel dashboard-panel">
        <div className="csv-import-copy">
          <span className="csv-icon">CSV</span>
          <div>
            <h2>Importer des contacts</h2>
            <p>
              Importez jusqu’à 5 000 contacts. Les doublons sont mis à jour
              automatiquement grâce à leur adresse email.
            </p>
          </div>
        </div>

        <form action={importContactsCsv} className="csv-import-form">
          <label className="csv-file-picker">
            <input name="csvFile" type="file" accept=".csv,text/csv" required />
            <span>Sélectionner un CSV</span>
          </label>
          <button className="secondary-action" type="submit">
            Importer
          </button>
          <a className="text-link" href="/modele-contacts.csv" download>
            Télécharger le modèle
          </a>
        </form>
      </section>

      <section className="module-grid">
        <article className="dashboard-panel form-panel">
          <div className="panel-header">
            <div>
              <h2>Ajouter un contact</h2>
              <p>Créez rapidement une nouvelle opportunité.</p>
            </div>
          </div>
          <form id="contact-form" action={createContact} className="premium-form">
            <div className="form-row">
              <label>Prénom<input name="firstName" placeholder="Lucas" required /></label>
              <label>Nom<input name="lastName" placeholder="Martin" required /></label>
            </div>
            <label>Entreprise<input name="companyName" placeholder="LM Conseil" /></label>
            <label>Email<input name="email" type="email" placeholder="lucas@entreprise.fr" /></label>
            <label>Téléphone<input name="phone" placeholder="+33 6 00 00 00 00" /></label>
            <label>Source<input name="source" placeholder="Google Ads, LinkedIn..." /></label>
            <label>Étape commerciale
              <select name="status">
                {Object.entries(statuses).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>Valeur estimée (€)<input name="value" type="number" min="0" placeholder="3500" /></label>
            <button className="primary-action full-width" type="submit">Ajouter au CRM</button>
          </form>
        </article>

        <article className="dashboard-panel list-panel">
          <div className="panel-header">
            <div>
              <h2>Contacts</h2>
              <p>{rows.length} contact{rows.length > 1 ? "s" : ""} enregistré{rows.length > 1 ? "s" : ""}</p>
            </div>
            <div className="compact-search"><Icon name="search" size={16}/><span>Rechercher...</span></div>
          </div>
          <div className="contact-list">
            {rows.map((contact) => (
              <div className="contact-row" key={contact.id}>
                <span className="contact-avatar">{contact.first_name[0]}{contact.last_name[0]}</span>
                <div className="contact-main">
                  <a href={`/contacts/${contact.id}`}><strong>{contact.first_name} {contact.last_name}</strong></a>
                  <small>{contact.company_name || contact.email || "Sans entreprise"}</small>
                </div>
                <span className={`status-pill ${contact.status.toLowerCase()}`}>
                  {statuses[contact.status] ?? contact.status}
                </span>
                <strong className="contact-value">{euro(Number(contact.value))}</strong>
                <button className="row-menu" type="button"><Icon name="more" size={18}/></button>
              </div>
            ))}
            {rows.length === 0 && <div className="empty-state">Ajoutez votre premier contact.</div>}
          </div>
        </article>
      </section>
    </>
  );
}
