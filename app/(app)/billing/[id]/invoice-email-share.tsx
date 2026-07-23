"use client";

import { useMemo, useState } from "react";

export function InvoiceEmailShare({
  invoiceNumber,
  clientName,
  recipient,
  publicUrl,
  issuerName,
}: {
  invoiceNumber: string;
  clientName: string;
  recipient: string;
  publicUrl: string;
  issuerName: string;
}) {
  const [email, setEmail] = useState(recipient);
  const [subject, setSubject] = useState(
    `Facture ${invoiceNumber} — ${issuerName}`,
  );
  const [message, setMessage] = useState(
    `Bonjour ${clientName || ""},\n\nVous pouvez consulter et télécharger votre facture ${invoiceNumber} ici :\n${publicUrl}\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${issuerName}`,
  );
  const [copied, setCopied] = useState(false);

  const mailtoUrl = useMemo(() => {
    const params = new URLSearchParams({ subject, body: message });
    return `mailto:${encodeURIComponent(email)}?${params.toString()}`;
  }, [email, subject, message]);

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className="dashboard-panel invoice-email-card">
      <div className="panel-header">
        <div>
          <h2>Envoyer par email</h2>
          <p>Ouvre votre application de messagerie avec le message prérempli.</p>
        </div>
      </div>

      <div className="premium-form invoice-email-form">
        <label>
          Destinataire
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="client@entreprise.fr"
          />
        </label>
        <label>
          Objet
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label>
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        <div className="invoice-email-actions">
          <button className="secondary-action" type="button" onClick={copyLink}>
            {copied ? "Lien copié" : "Copier le lien"}
          </button>
          <a className="primary-action" href={mailtoUrl}>
            Ouvrir la messagerie
          </a>
        </div>
      </div>

      <p className="invoice-share-note">
        Le PDF n’est pas joint automatiquement : le client reçoit un lien sécurisé pour le consulter et le télécharger.
      </p>
    </article>
  );
}
