import Link from "next/link";
import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { buildPublicInvoiceUrl, tryBuildPublicQuoteSignUrl } from "@/lib/invoice-share";
import { normalizeFrenchPhone } from "@/lib/phone";
import { InvoiceMessageShare } from "./invoice-message-share";
import { InvoiceEmailShare } from "./invoice-email-share";
import { QuoteSignShare } from "./quote-sign-share";
import {
  addDocumentItem,
  convertQuoteToInvoice,
  createCreditNoteFromInvoice,
  deleteDocumentPayment,
  deleteSalesDocument,
  recordDocumentPayment,
  updateDocumentStatus
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

  const [documents, items, stripeConnections, payments] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name,
             c.email, c.phone, c.address, c.siret, c.vat_number,
             src.document_number AS source_document_number
      FROM sales_documents d
      LEFT JOIN contacts c ON c.id = d.contact_id
      LEFT JOIN sales_documents src ON src.id = d.source_invoice_id
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
    query<any>(
      `
      SELECT id, amount, paid_at, method, notes
      FROM document_payments
      WHERE document_id = $1 AND company_id = $2
      ORDER BY paid_at DESC, created_at DESC
      `,
      [id, member.company_id],
    ),
  ]);


  const document = documents[0];
  if (!document) notFound();
  const stripeConnection = stripeConnections[0];
  const stripeSettings = stripeConnection?.settings || {};
  const stripeReady = Boolean(
    stripeSettings.accountId && stripeSettings.chargesEnabled,
  );
  let publicInvoiceUrl = "";
  let publicQuoteSignUrl = "";

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

  if (
    document.document_type === "QUOTE" &&
    ["SENT", "ACCEPTED"].includes(document.status)
  ) {
    publicQuoteSignUrl = tryBuildPublicQuoteSignUrl(
      document.id,
      member.company_id,
    );
  }

  const paidSum = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const remainingDue = Math.max(0, Number(document.total) - paidSum);
  const clientDisplayName =
    document.company_name ||
    `${document.first_name ?? ""} ${document.last_name ?? ""}`.trim();

  return (
    <>
      <section className="page-heading">
        <div>
          <Link className="back-link" href="/billing">← Retour à la facturation</Link>
          <p className="eyebrow">
            {document.document_type === "QUOTE"
              ? "Devis"
              : document.document_type === "CREDIT_NOTE"
                ? "Avoir"
                : "Facture"}
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

      {(feedback.created || feedback.saved || feedback.itemAdded || feedback.converted || feedback.paymentAdded) && (
        <div className="import-alert success">
          <strong>Document enregistré.</strong>
          <span>Les informations sont à jour.</span>
        </div>
      )}

      {(feedback.error === "payment" || feedback.error === "credit") && (
        <div className="import-alert error">
          <strong>Enregistrement impossible.</strong>
          <span>Vérifiez le montant et les informations saisies.</span>
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

          {document.document_type === "CREDIT_NOTE" && document.source_document_number && (
            <article className="dashboard-panel">
              <div className="panel-header"><div><h2>Avoir lié</h2><p>Facture d’origine</p></div></div>
              <p><strong>{document.source_document_number}</strong></p>
            </article>
          )}

          {document.document_type === "QUOTE" && publicQuoteSignUrl && (
            <QuoteSignShare
              quoteNumber={document.document_number}
              clientName={clientDisplayName}
              recipient={document.email || ""}
              publicUrl={publicQuoteSignUrl}
              issuerName={member.company_name || "PulseERP"}
              signed={document.status === "ACCEPTED"}
            />
          )}

          {document.document_type === "QUOTE" && !publicQuoteSignUrl && document.status === "SENT" && (
            <article className="dashboard-panel invoice-message-card">
              <div className="panel-header">
                <div>
                  <h2>Signature en ligne</h2>
                  <p>Configurez le secret de partage pour activer cette fonction.</p>
                </div>
              </div>
              <div className="invoice-email-warning">
                Ajoutez <code>INVOICE_SHARE_SECRET</code> dans Vercel,
                puis redéployez l’application.
              </div>
            </article>
          )}

          {document.document_type === "INVOICE" && (
            <article className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Acomptes et paiements</h2>
                  <p>{euro(paidSum)} réglés — reste dû : {euro(remainingDue)}</p>
                </div>
              </div>
              {payments.length > 0 && (
                <div className="invoice-lines">
                  {payments.map((payment) => (
                    <div className="invoice-line" key={payment.id}>
                      <div>
                        <strong>{euro(Number(payment.amount))}</strong>
                        <small>
                          {" "}{new Date(payment.paid_at).toLocaleDateString("fr-FR")}
                          {payment.method ? ` — ${payment.method}` : ""}
                          {payment.notes ? ` — ${payment.notes}` : ""}
                        </small>
                      </div>
                      <form action={deleteDocumentPayment}>
                        <input type="hidden" name="documentId" value={document.id} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <button className="danger-action" type="submit">Retirer</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              {document.status !== "PAID" && document.status !== "CANCELLED" && (
                <form action={recordDocumentPayment} className="premium-form">
                  <input type="hidden" name="documentId" value={document.id} />
                  <div className="form-row">
                    <label>Montant (€)
                      <input name="amount" type="number" step="0.01" min="0.01" placeholder={String(remainingDue.toFixed(2))} required />
                    </label>
                    <label>Date
                      <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>Moyen
                      <input name="method" placeholder="Virement, CB, espèces..." />
                    </label>
                    <label>Notes
                      <input name="notes" placeholder="Référence..." />
                    </label>
                  </div>
                  <button className="secondary-action full-width" type="submit">
                    Enregistrer l’acompte
                  </button>
                </form>
              )}
            </article>
          )}

          {document.document_type === "INVOICE" && document.status !== "CANCELLED" && (
            <article className="dashboard-panel conversion-card">
              <h2>Émettre un avoir</h2>
              <p>Remboursement total ou partiel : l’avoir reprend les lignes de cette facture.</p>
              <form action={createCreditNoteFromInvoice}>
                <input type="hidden" name="documentId" value={document.id} />
                <button className="secondary-action full-width" type="submit">
                  Créer un avoir
                </button>
              </form>
            </article>
          )}

          {document.document_type === "INVOICE" && document.status !== "PAID" && (
            <article className="dashboard-panel conversion-card">
              <h2>Paiement en ligne</h2>
              <p>Cette fonction sera disponible après la phase de stabilisation.</p>
              <button className="secondary-action full-width" type="button" disabled>
                Bientôt disponible
              </button>
            </article>
          )}


          {document.document_type === "INVOICE" &&
            publicInvoiceUrl && (
              <InvoiceEmailShare
                invoiceNumber={document.document_number}
                clientName={clientDisplayName}
                recipient={document.email || ""}
                publicUrl={publicInvoiceUrl}
                issuerName={member.company_name || "PulseERP"}
              />
            )}

          {document.document_type === "INVOICE" &&
            !publicInvoiceUrl && (
              <article className="dashboard-panel invoice-email-card">
                <div className="panel-header">
                  <div>
                    <h2>Envoyer par email</h2>
                    <p>Le lien sécurisé doit être configuré avant le partage.</p>
                  </div>
                </div>
                <div className="invoice-email-warning">
                  Ajoutez <code>INVOICE_SHARE_SECRET</code> dans Vercel, puis redéployez.
                </div>
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
