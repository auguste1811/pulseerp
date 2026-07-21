import Link from "next/link";
import { notFound } from "next/navigation";
import { currentContext } from "@/lib/auth";
import {
  categoryLabels,
  dateInputValue,
  type OcrInvoiceData,
} from "@/lib/invoice-ocr";
import { prisma } from "@/lib/prisma";
import { applyPurchaseInvoiceOcr } from "../../ocr-actions";

export default async function OcrReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await currentContext();
  const { id } = await params;
  const feedback = await searchParams;

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: {
      id,
      companyId: member.company_id,
    },
  });

  if (!invoice) notFound();

  const data = (invoice.ocrData || {}) as Partial<OcrInvoiceData>;
  const confidence = Number(invoice.ocrConfidence || data.confidence || 0);
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];

  return (
    <>
      <section className="page-heading accounting-heading">
        <div>
          <p className="eyebrow">Contrôle documentaire</p>
          <h1>Vérification OCR</h1>
          <p>
            Contrôlez les informations avant leur validation comptable.
          </p>
        </div>

        <div className="accounting-heading-actions">
          <Link className="secondary-action" href="/transactions">
            Retour à la comptabilité
          </Link>
          <a
            className="primary-action"
            href={`/api/accounting/purchases/${invoice.id}/download`}
            target="_blank"
          >
            Ouvrir le document
          </a>
        </div>
      </section>

      {feedback.error && (
        <div className="import-alert error">
          <strong>Validation impossible.</strong>
          <span>Vérifiez les champs obligatoires et les montants.</span>
        </div>
      )}

      <section className="ocr-review-grid">
        <article className="dashboard-panel ocr-document-panel">
          <div className="panel-header">
            <div>
              <h2>Document source</h2>
              <p>{invoice.originalName}</p>
            </div>
            <span
              className={`ocr-confidence ${
                confidence >= 0.85
                  ? "high"
                  : confidence >= 0.65
                    ? "medium"
                    : "low"
              }`}
            >
              Confiance {Math.round(confidence * 100)} %
            </span>
          </div>

          {invoice.mimeType.startsWith("image/") ? (
            <img
              className="ocr-preview-image"
              src={`/api/accounting/purchases/${invoice.id}/download`}
              alt={`Aperçu de ${invoice.originalName}`}
            />
          ) : (
            <iframe
              className="ocr-preview-frame"
              src={`/api/accounting/purchases/${invoice.id}/download`}
              title={`Aperçu de ${invoice.originalName}`}
            />
          )}

          {warnings.length > 0 && (
            <div className="ocr-warning-box">
              <strong>Points à vérifier</strong>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="dashboard-panel form-panel ocr-form-panel">
          <div className="panel-header">
            <div>
              <h2>Données extraites</h2>
              <p>Modifiez les champs incorrects avant validation.</p>
            </div>
            <span className={`status-pill ${invoice.ocrStatus.toLowerCase()}`}>
              {invoice.ocrStatus}
            </span>
          </div>

          <form action={applyPurchaseInvoiceOcr} className="premium-form">
            <input type="hidden" name="id" value={invoice.id} />

            <label>
              Fournisseur
              <input
                name="supplierName"
                defaultValue={data.supplierName || invoice.supplierName}
                required
              />
            </label>

            <label>
              N° de facture
              <input
                name="invoiceNumber"
                defaultValue={
                  data.invoiceNumber || invoice.invoiceNumber || ""
                }
              />
            </label>

            <div className="form-row">
              <label>
                Date de facture
                <input
                  name="issueDate"
                  type="date"
                  defaultValue={
                    data.issueDate ||
                    dateInputValue(invoice.issueDate)
                  }
                  required
                />
              </label>

              <label>
                Échéance
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={
                    data.dueDate ||
                    dateInputValue(invoice.dueDate)
                  }
                />
              </label>
            </div>

            <label>
              Catégorie
              <select
                name="category"
                defaultValue={data.category || invoice.category}
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row three">
              <label>
                HT
                <input
                  name="subtotal"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={data.subtotal ?? Number(invoice.subtotal)}
                  required
                />
              </label>

              <label>
                TVA
                <input
                  name="vatAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={data.vatAmount ?? Number(invoice.vatAmount)}
                  required
                />
              </label>

              <label>
                TTC
                <input
                  name="total"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={data.total ?? Number(invoice.total)}
                  required
                />
              </label>
            </div>

            <label>
              Notes internes
              <textarea
                name="notes"
                rows={4}
                defaultValue={invoice.notes || ""}
              />
            </label>

            <div className="ocr-extra-data">
              <span>
                Devise : <strong>{data.currency || "EUR"}</strong>
              </span>
              {data.supplierVatNumber && (
                <span>
                  TVA fournisseur :{" "}
                  <strong>{data.supplierVatNumber}</strong>
                </span>
              )}
              {data.supplierSiret && (
                <span>
                  SIRET : <strong>{data.supplierSiret}</strong>
                </span>
              )}
              {data.iban && (
                <span>
                  IBAN détecté : <strong>{data.iban}</strong>
                </span>
              )}
            </div>

            <button className="primary-action full-width" type="submit">
              Valider et mettre à jour la comptabilité
            </button>
          </form>
        </article>
      </section>
    </>
  );
}
