import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { verifyInvoiceShareToken } from "@/lib/invoice-share";

export const dynamic = "force-dynamic";

export default async function PublicQuoteSign({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query_params = await searchParams;
  const token = query_params.token || "";

  const documents = await query<any>(
    `
    SELECT d.*, c.first_name, c.last_name, c.company_name,
           co.name AS issuer_name,
           co.legal_name AS issuer_legal_name,
           co.logo_url AS issuer_logo_url
    FROM sales_documents d
    JOIN companies co ON co.id = d.company_id
    LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = $1 AND d.document_type = 'QUOTE'
    LIMIT 1
    `,
    [id],
  );

  const document = documents[0];
  if (
    !document ||
    !token ||
    !verifyInvoiceShareToken(token, id, document.company_id)
  ) {
    notFound();
  }

  const items = await query<any>(
    `
    SELECT description, quantity, unit_price, vat_rate, line_total
    FROM sales_document_items
    WHERE document_id = $1
    ORDER BY position, id
    `,
    [id],
  );

  const signed = document.status === "ACCEPTED";
  const canSign = document.status === "SENT";
  const expired =
    document.valid_until && new Date(document.valid_until) < new Date();
  const pdfUrl = `/api/public/quotes/${encodeURIComponent(id)}/pdf?token=${encodeURIComponent(token)}`;

  return (
    <main
      className="print-document"
      style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}
    >
      <header className="print-header">
        <div>
          {document.issuer_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.issuer_logo_url}
              alt="Logo"
              style={{ maxHeight: 60, maxWidth: 160, objectFit: "contain" }}
            />
          ) : (
            <span className="print-logo">P</span>
          )}
          <strong>{document.issuer_legal_name || document.issuer_name}</strong>
        </div>
        <div style={{ textAlign: "right" }}>
          <p>DEVIS</p>
          <h1>{document.document_number}</h1>
        </div>
      </header>

      {query_params.signed && (
        <div className="import-alert success">
          <strong>Devis signé, merci.</strong>
          <span>
            {document.signed_by
              ? `Signé par ${document.signed_by}.`
              : "Votre acceptation a bien été enregistrée."}{" "}
            {document.issuer_name} reviendra vers vous.
          </span>
        </div>
      )}
      {query_params.error && (
        <div className="import-alert error">
          <strong>Signature impossible.</strong>
          <span>
            Indiquez votre nom et vérifiez que le devis est toujours valable.
          </span>
        </div>
      )}

      {signed && (
        <div className="import-alert success">
          <strong>Ce devis est accepté.</strong>
          <span>
            {document.signed_by ? `Signé par ${document.signed_by}` : ""}
            {document.signed_at
              ? ` le ${new Date(document.signed_at).toLocaleDateString("fr-FR")}`
              : ""}
            .
          </span>
        </div>
      )}

      {expired && !signed && (
        <div className="import-alert error">
          <strong>Devis expiré.</strong>
          <span>
            Validité dépassée le{" "}
            {new Date(document.valid_until).toLocaleDateString("fr-FR")}.
            Contactez {document.issuer_name} pour un nouveau devis.
          </span>
        </div>
      )}

      <section className="print-meta">
        <div>
          <span>Date</span>
          <strong>{new Date(document.issue_date).toLocaleDateString("fr-FR")}</strong>
        </div>
        <div>
          <span>Validité</span>
          <strong>
            {document.valid_until
              ? new Date(document.valid_until).toLocaleDateString("fr-FR")
              : "—"}
          </strong>
        </div>
        <div>
          <span>Total TTC</span>
          <strong>{euro(Number(document.total))}</strong>
        </div>
      </section>

      <table className="print-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qté</th>
            <th>Prix HT</th>
            <th>TVA</th>
            <th>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{item.description}</td>
              <td>{Number(item.quantity).toLocaleString("fr-FR")}</td>
              <td>{euro(Number(item.unit_price))}</td>
              <td>{Number(item.vat_rate).toLocaleString("fr-FR")} %</td>
              <td>{euro(Number(item.line_total))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="print-totals">
        <div><span>Sous-total HT</span><strong>{euro(Number(document.subtotal))}</strong></div>
        <div><span>TVA</span><strong>{euro(Number(document.vat_amount))}</strong></div>
        <div><span>Total TTC</span><strong>{euro(Number(document.total))}</strong></div>
      </section>

      {canSign && (
        <form
          action={`/api/public/quotes/${encodeURIComponent(id)}/sign`}
          method="POST"
          className="premium-form"
          style={{ marginTop: 24 }}
        >
          <input type="hidden" name="token" value={token} />
          <label>
            Votre nom (signature)
            <input name="signerName" placeholder="Prénom Nom" required maxLength={160} />
          </label>
          <p className="subscription-footnote">
            En signant, vous acceptez ce devis et ses conditions. Cette action
            vaut bon pour accord.
          </p>
          <button className="primary-action full-width" type="submit">
            Signer le devis
          </button>
        </form>
      )}

      <p style={{ marginTop: 20, textAlign: "center" }}>
        <a href={pdfUrl} target="_blank" rel="noreferrer">
          Télécharger le PDF
        </a>
      </p>
    </main>
  );
}
