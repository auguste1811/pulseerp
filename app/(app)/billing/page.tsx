import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../components/icons";
import { createSalesDocument } from "./actions";

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  PAID: "Payé",
  OVERDUE: "Impayé",
  CANCELLED: "Annulé",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const member = await currentContext();
  const params = await searchParams;

  const [documents, contacts] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name
      FROM sales_documents d
      LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.company_id = $1
      ORDER BY d.issue_date DESC, d.created_at DESC
      `,
      [member.company_id],
    ),
    query<any>(
      `
      SELECT id, first_name, last_name, company_name
      FROM contacts
      WHERE company_id = $1
      ORDER BY last_name, first_name
      `,
      [member.company_id],
    ),
  ]);

  const invoices = documents.filter((doc) => doc.document_type === "INVOICE");
  const quotes = documents.filter((doc) => doc.document_type === "QUOTE");
  const paidTotal = invoices
    .filter((doc) => doc.status === "PAID")
    .reduce((sum, doc) => sum + Number(doc.total), 0);
  const pendingTotal = invoices
    .filter((doc) => ["SENT", "OVERDUE"].includes(doc.status))
    .reduce((sum, doc) => sum + Number(doc.total), 0);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Devis & facturation</h1>
          <p>Créez, envoyez et suivez vos documents commerciaux.</p>
        </div>
      </section>

      {params.error && (
        <div className="import-alert error">
          <strong>Création impossible.</strong>
          <span>Vérifiez le client et les informations du document.</span>
        </div>
      )}

      <section className="billing-stats-grid">
        <div><span>Factures</span><strong>{invoices.length}</strong></div>
        <div><span>Devis</span><strong>{quotes.length}</strong></div>
        <div><span>Encaissé</span><strong>{euro(paidTotal)}</strong></div>
        <div><span>À recevoir</span><strong>{euro(pendingTotal)}</strong></div>
      </section>

      <section className="module-grid">
        <article className="dashboard-panel form-panel">
          <div className="panel-header">
            <div>
              <h2>Nouveau document</h2>
              <p>Créez rapidement un devis ou une facture.</p>
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="empty-state">
              Ajoutez d’abord un client dans le CRM.
              <br />
              <Link className="text-link" href="/contacts">Ouvrir le CRM</Link>
            </div>
          ) : (
            <form action={createSalesDocument} className="premium-form">
              <label>Client
                <select name="contactId" required>
                  <option value="">Sélectionner...</option>
                  {contacts.map((contact) => (
                    <option value={contact.id} key={contact.id}>
                      {contact.first_name} {contact.last_name}
                      {contact.company_name ? ` — ${contact.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>Type
                <select name="documentType" defaultValue="QUOTE">
                  <option value="QUOTE">Devis</option>
                  <option value="INVOICE">Facture</option>
                </select>
              </label>

              <div className="form-row">
                <label>Date d’émission
                  <input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
                </label>
                <label>Échéance facture
                  <input name="dueDate" type="date" />
                </label>
              </div>

              <label>Validité du devis
                <input name="validUntil" type="date" />
              </label>

              <label>Description
                <input name="description" placeholder="Prestation de conseil" required />
              </label>

              <div className="form-row">
                <label>Quantité
                  <input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" required />
                </label>
                <label>Prix unitaire HT
                  <input name="unitPrice" type="number" step="0.01" min="0" required />
                </label>
              </div>

              <label>TVA (%)
                <input name="vatRate" type="number" step="0.1" min="0" defaultValue="20" />
              </label>

              <label>Notes
                <input name="notes" placeholder="Conditions, informations complémentaires..." />
              </label>

              <button className="primary-action full-width" type="submit">
                Créer le document
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-panel list-panel">
          <div className="panel-header">
            <div>
              <h2>Documents commerciaux</h2>
              <p>{documents.length} document{documents.length > 1 ? "s" : ""}</p>
            </div>
          </div>

          <div className="billing-list">
            {documents.map((doc) => (
              <Link className="billing-row" href={`/billing/${doc.id}`} key={doc.id}>
                <span className={`document-type-icon ${doc.document_type.toLowerCase()}`}>
                  {doc.document_type === "QUOTE" ? "DEV" : "FAC"}
                </span>
                <div>
                  <strong>{doc.document_number}</strong>
                  <small>
                    {doc.company_name ||
                      `${doc.first_name ?? ""} ${doc.last_name ?? ""}`.trim() ||
                      "Client supprimé"}
                  </small>
                </div>
                <span className={`status-pill ${doc.status.toLowerCase()}`}>
                  {statusLabels[doc.status] ?? doc.status}
                </span>
                <small>{new Date(doc.issue_date).toLocaleDateString("fr-FR")}</small>
                <strong>{euro(Number(doc.total))}</strong>
                <Icon name="arrowUp" size={14} className="billing-open-icon" />
              </Link>
            ))}
            {documents.length === 0 && (
              <div className="empty-state">Créez votre premier devis.</div>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
