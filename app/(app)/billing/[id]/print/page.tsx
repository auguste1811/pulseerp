import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";

export default async function PrintableDocument({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await currentContext();
  const { id } = await params;

  const [documents, items] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name,
             c.email, c.phone, c.address, c.siret, c.vat_number,
             co.name AS issuer_name,
             co.legal_name AS issuer_legal_name,
             co.address AS issuer_address,
             co.postal_code AS issuer_postal_code,
             co.city AS issuer_city,
             co.country AS issuer_country,
             co.email AS issuer_email,
             co.phone AS issuer_phone,
             co.website AS issuer_website,
             co.siret AS issuer_siret,
             co.vat_number AS issuer_vat_number,
             co.iban AS issuer_iban,
             co.bic AS issuer_bic,
             co.invoice_footer AS issuer_footer
      FROM sales_documents d
      JOIN companies co ON co.id = d.company_id
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
  ]);

  const document = documents[0];
  if (!document) notFound();

  return (
    <main className="print-document">
      <header className="print-header">
        <div>
          <span className="print-logo">P</span>
          <strong>{document.issuer_name}</strong>
        </div>
        <div>
          <p>{document.document_type === "QUOTE" ? "DEVIS" : "FACTURE"}</p>
          <h1>{document.document_number}</h1>
        </div>
      </header>

      <section className="print-parties">
        <div>
          <span>Émetteur</span>
          <strong>{document.issuer_legal_name || document.issuer_name}</strong>
          {document.issuer_address && <p>{document.issuer_address}</p>}
          {(document.issuer_postal_code || document.issuer_city) && (
            <p>{document.issuer_postal_code} {document.issuer_city}</p>
          )}
          {document.issuer_country && <p>{document.issuer_country}</p>}
          {document.issuer_email && <p>{document.issuer_email}</p>}
          {document.issuer_phone && <p>{document.issuer_phone}</p>}
          {document.issuer_siret && <p>SIRET : {document.issuer_siret}</p>}
          {document.issuer_vat_number && <p>TVA : {document.issuer_vat_number}</p>}
        </div>
        <div>
          <span>Destinataire</span>
          <strong>{document.company_name || `${document.first_name} ${document.last_name}`}</strong>
          {document.address && <p>{document.address}</p>}
          {document.email && <p>{document.email}</p>}
          {document.siret && <p>SIRET : {document.siret}</p>}
          {document.vat_number && <p>TVA : {document.vat_number}</p>}
        </div>
      </section>

      <section className="print-meta">
        <div><span>Date</span><strong>{new Date(document.issue_date).toLocaleDateString("fr-FR")}</strong></div>
        <div><span>Échéance</span><strong>{document.due_date ? new Date(document.due_date).toLocaleDateString("fr-FR") : "—"}</strong></div>
        <div><span>Statut</span><strong>{document.status}</strong></div>
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
          {items.map((item) => (
            <tr key={item.id}>
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

      {(document.issuer_iban || document.issuer_bic) && (
        <section className="print-notes">
          <strong>Coordonnées bancaires</strong>
          {document.issuer_iban && <p>IBAN : {document.issuer_iban}</p>}
          {document.issuer_bic && <p>BIC : {document.issuer_bic}</p>}
        </section>
      )}

      {document.notes && (
        <section className="print-notes">
          <strong>Notes</strong>
          <p>{document.notes}</p>
        </section>
      )}

      {document.issuer_footer && (
        <section className="print-notes">
          <strong>Mentions</strong>
          <p>{document.issuer_footer}</p>
        </section>
      )}

      <p className="print-hint">
        Utilisez ⌘P sur Mac ou Ctrl+P sur Windows pour enregistrer ce document en PDF.
      </p>
    </main>
  );
}
