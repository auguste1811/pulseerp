import Link from "next/link";
import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { buildPublicInvoiceUrl } from "@/lib/invoice-share";
import { normalizeFrenchPhone } from "@/lib/phone";
import { InvoiceMessageShare } from "./invoice-message-share";
import {
  addDocumentItem,
  convertQuoteToInvoice,
  deleteSalesDocument,
  updateDocumentStatus,
  sendInvoiceEmail,
} from "../actions";

const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  PAID: "Payé",
  OVERDUE: "Impayé",
  CANCELLED: "Annulé",
};

export default async function BillingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const member = await currentContext();
  const { id } = await params;
  const feedback = await searchParams;

  const [documents, items, stripeConnections] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name,
             c.email, c.phone, c.address, c.siret, c.vat_number
      FROM sales_documents d
      LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.id = $1 AND d.company_id = $2
      LIMIT 1
      `,
      [id, member.company_id],
    ),
    query<any>(
      `
      SELECT *
      FROM sales_document_items
      WHERE document_id = $1
      ORDER BY position, id
      `,
      [id],
    ),
    query<any>(
      `
      SELECT status, settings
      FROM integration_connections
      WHERE company_id=$1 AND provider='STRIPE'
      LIMIT 1
      `,
      [member.company_id],
    ),
  ]);

  let emailLogs: any[] = [];

  try {
    emailLogs = await query<any>(
      `
      SELECT recipient, subject, status, sent_at, created_at
      FROM sales_document_emails
      WHERE document_id=$1 AND company_id=$2
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [id, member.company_id],
    );
  } catch (error) {
    // La migration des journaux d'emails peut ne pas encore être appliquée.
    // Elle ne doit jamais empêcher l'ouverture d'un devis ou d'une facture.
    console.warn("Historique des emails indisponible", error);
  }

  const document = documents[0];
  if (!document) notFound();
  const stripeConnection = stripeConnections[0];
  const stripeSettings = stripeConnection?.settings || {};
  const stripeReady = Boolean(
    stripeSettings.accountId && stripeSettings.chargesEnabled,
  );
  let publicInvoiceUrl = "";

  if (document.document_type === "INVOICE") {
    try {
      publicInvoiceUrl = buildPublicInvoiceUrl(
        document.id,
        member.company_id,
      );
    } catch (error) {
      // Le partage SMS/WhatsApp reste optionnel. Une variable manquante
      // ne doit pas rendre la facture inaccessible.
      console.warn("Lien public de facture indisponible", error);
    }
  }
  const clientDisplayName =
    document.company_name ||
    `${document.first_name ?? ""} ${document.last_name ?? ""}`.trim();

  return (
    <>
      <section className="page-heading">
        <div>
          <Link className="back-link" href="/billing">← Retour à la facturation</Link>
          <p className="eyebrow">
            {document.document_type === "QUOTE" ? "Devis" : "Facture"}
          </p>
          <h1>{document.document_number}</h1>
          <p>
            {document.company_name ||
              `${document.first_name ?? ""} ${document.last_name ?? ""}`.trim()}
          </p>
        </div>

        <div className="heading-actions">
          <Link
            className="secondary-action"
            href={`/billing/${document.id}/print`}
            target="_blank"
          >
            Imprimer / PDF
          </Link>
          <span className={`status-pill ${document.status.toLowerCase()}`}>
            {statusLabels[document.status] ?? document.status}
          </span>
        </div>
      </section>

      {(feedback.created || feedback.saved || feedback.itemAdded || feedback.converted) && (
        <div className="import-alert success">
          <strong>Document enregistré.</strong>
          <span>Les informations sont à jour.</span>
        </div>
      )}

      {feedback.payment === "success" && (
        <div className="import-alert success">
          <strong>Paiement reçu.</strong>
          <span>Stripe confirme le règlement. Le statut sera synchronisé par webhook.</span>
        </div>
      )}

      {feedback.payment && feedback.payment !== "success" && (
        <div className="import-alert error">
          <strong>Paiement non finalisé.</strong>
          <span>Le paiement a été annulé ou Stripe n’est pas encore disponible.</span>
        </div>
      )}

      {feedback.emailSent && (
        <div className="import-alert success">
          <strong>Facture envoyée.</strong>
          <span>Le client a reçu l’email avec la facture PDF en pièce jointe.</span>
        </div>
      )}

      {feedback.emailError && (
        <div className="import-alert error">
          <strong>Envoi impossible.</strong>
          <span>
            {feedback.emailError === "invalid"
              ? "Vérifiez l’adresse email, l’objet et le message."
              : feedback.emailError === "invoice"
                ? "Seules les factures peuvent être envoyées depuis ce formulaire."
                : "Vérifiez la configuration Resend et réessayez."}
          </span>
        </div>
      )}

      <section className="billing-detail-grid">
        <div className="billing-detail-main">
          <article className="dashboard-panel">
            <div className="document-meta-grid">
              <div><span>Client</span><strong>{document.company_name || `${document.first_name} ${document.last_name}`}</strong></div>
              <div><span>Date d’émission</span><strong>{new Date(document.issue_date).toLocaleDateString("fr-FR")}</strong></div>
              <div><span>Échéance</span><strong>{document.due_date ? new Date(document.due_date).toLocaleDateString("fr-FR") : "—"}</strong></div>
              <div><span>Validité</span><strong>{document.valid_until ? new Date(document.valid_until).toLocaleDateString("fr-FR") : "—"}</strong></div>
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-header">
              <div><h2>Lignes du document</h2><p>Prestations et produits facturés</p></div>
            </div>

            <div className="invoice-lines">
              <div className="invoice-line invoice-line-head">
                <span>Description</span><span>Qté</span><span>PU HT</span><span>TVA</span><span>Total TTC</span>
              </div>
              {items.map((item) => (
                <div className="invoice-line" key={item.id}>
                  <strong>{item.description}</strong>
                  <span>{Number(item.quantity).toLocaleString("fr-FR")}</span>
                  <span>{euro(Number(item.unit_price))}</span>
                  <span>{Number(item.vat_rate).toLocaleString("fr-FR")} %</span>
                  <strong>{euro(Number(item.line_total))}</strong>
                </div>
              ))}
            </div>

            <form action={addDocumentItem} className="add-line-form">
              <input type="hidden" name="documentId" value={document.id} />
              <input name="description" placeholder="Nouvelle prestation" required />
              <input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" required />
              <input name="unitPrice" type="number" step="0.01" min="0" placeholder="Prix HT" required />
              <input name="vatRate" type="number" step="0.1" min="0" defaultValue="20" />
              <button className="secondary-action" type="submit">Ajouter</button>
            </form>
          </article>

          {document.notes && (
            <article className="dashboard-panel">
              <div className="panel-header"><div><h2>Notes</h2></div></div>
              <p className="document-notes">{document.notes}</p>
            </article>
          )}
        </div>

        <aside className="billing-sidebar">
          <article className="dashboard-panel billing-totals">
            <h2>Total</h2>
            <div><span>Sous-total HT</span><strong>{euro(Number(document.subtotal))}</strong></div>
            <div><span>TVA</span><strong>{euro(Number(document.vat_amount))}</strong></div>
            <div className="grand-total"><span>Total TTC</span><strong>{euro(Number(document.total))}</strong></div>
          </article>

          {document.document_type === "INVOICE" && document.status !== "PAID" && (
            <article className="dashboard-panel conversion-card">
              <h2>Paiement en ligne</h2>
              <p>Cette fonction sera disponible après la phase de stabilisation.</p>
              <button className="secondary-action full-width" type="button" disabled>
                Bientôt disponible
              </button>
            </article>
          )}


          {document.document_type === "INVOICE" && (
            <article className="dashboard-panel invoice-email-card">
              <div className="panel-header">
                <div>
                  <h2>Envoyer par email</h2>
                  <p>La facture PDF sera automatiquement jointe.</p>
                </div>
              </div>

              {!process.env.RESEND_API_KEY && (
                <div className="invoice-email-warning">
                  Configurez <code>RESEND_API_KEY</code> et <code>EMAIL_FROM</code> dans Vercel.
                </div>
              )}

              <form action={sendInvoiceEmail} className="premium-form invoice-email-form">
                <input type="hidden" name="documentId" value={document.id} />
                <label>
                  Destinataire
                  <input
                    name="recipient"
                    type="email"
                    defaultValue={document.email || ""}
                    placeholder="client@entreprise.fr"
                    required
                  />
                </label>
                <label>
                  Objet
                  <input
                    name="subject"
                    defaultValue={`Facture ${document.document_number} — ${member.company_name || "PulseERP"}`}
                    required
                  />
                </label>
                <label>
                  Message
                  <textarea
                    name="message"
                    defaultValue={`Veuillez trouver ci-joint votre facture ${document.document_number}.\n\nNous restons à votre disposition pour toute question.`}
                    required
                  />
                </label>
                <div className="invoice-email-actions">
                  <Link
                    className="secondary-action"
                    href={`/api/billing/documents/${document.id}/pdf`}
                    target="_blank"
                  >
                    Télécharger le PDF
                  </Link>
                  <button
                    className="primary-action"
                    type="submit"
                    disabled={!process.env.RESEND_API_KEY}
                  >
                    Envoyer la facture
                  </button>
                </div>
              </form>

              {emailLogs.length > 0 && (
                <div className="invoice-email-history">
                  <strong>Derniers envois</strong>
                  {emailLogs.map((email: any, index: number) => (
                    <div key={`${email.created_at}-${index}`}>
                      <span>{email.recipient}</span>
                      <small>
                        {email.status === "SENT" ? "Envoyée" : "Échec"}
                        {" · "}
                        {new Date(email.sent_at || email.created_at).toLocaleString("fr-FR")}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )}

          {document.document_type === "INVOICE" &&
            publicInvoiceUrl && (
              <InvoiceMessageShare
                invoiceNumber={document.document_number}
                clientName={clientDisplayName}
                phone={normalizeFrenchPhone(document.phone)}
                publicUrl={publicInvoiceUrl}
                issuerName={member.company_name || "PulseERP"}
              />
            )}

          {document.document_type === "INVOICE" &&
            !publicInvoiceUrl && (
              <article className="dashboard-panel invoice-message-card">
                <div className="panel-header">
                  <div>
                    <h2>Envoi par SMS ou WhatsApp</h2>
                    <p>
                      Configurez le secret de partage pour activer cette fonction.
                    </p>
                  </div>
                </div>
                <div className="invoice-email-warning">
                  Ajoutez <code>INVOICE_SHARE_SECRET</code> dans Vercel,
                  puis redéployez l’application.
                </div>
              </article>
            )}

          <article className="dashboard-panel">
            <div className="panel-header"><div><h2>Statut</h2><p>Mettez à jour le suivi</p></div></div>
            <form action={updateDocumentStatus} className="premium-form">
              <input type="hidden" name="documentId" value={document.id} />
              <select name="status" defaultValue={document.status}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
              <button className="primary-action full-width" type="submit">
                Enregistrer le statut
              </button>
            </form>
          </article>

          {document.document_type === "QUOTE" && (
            <article className="dashboard-panel conversion-card">
              <h2>Devis accepté ?</h2>
              <p>Convertissez-le en facture sans ressaisir les lignes.</p>
              <form action={convertQuoteToInvoice}>
                <input type="hidden" name="documentId" value={document.id} />
                <button className="primary-action full-width" type="submit">
                  Convertir en facture
                </button>
              </form>
            </article>
          )}

          {document.status === "DRAFT" && (
            <article className="dashboard-panel danger-zone billing-danger">
              <div><h2>Supprimer</h2><p>Uniquement disponible pour un brouillon.</p></div>
              <form action={deleteSalesDocument}>
                <input type="hidden" name="documentId" value={document.id} />
                <button className="danger-action" type="submit">Supprimer</button>
              </form>
            </article>
          )}
        </aside>
      </section>
    </>
  );
}
