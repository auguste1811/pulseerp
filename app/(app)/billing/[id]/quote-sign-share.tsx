"use client";

import { useMemo, useState } from "react";

export function QuoteSignShare({
  quoteNumber,
  clientName,
  recipient,
  publicUrl,
  issuerName,
  signed,
}: {
  quoteNumber: string;
  clientName: string;
  recipient: string;
  publicUrl: string;
  issuerName: string;
  signed: boolean;
}) {
  const [email, setEmail] = useState(recipient);
  const [subject, setSubject] = useState(
    `Devis ${quoteNumber} à signer — ${issuerName}`,
  );
  const [message, setMessage] = useState(
    `Bonjour ${clientName || ""},\n\nVous pouvez consulter et signer votre devis ${quoteNumber} ici :\n${publicUrl}\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${issuerName}`,
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
          <h2>Signature en ligne</h2>
          <p>
            {signed
              ? "Ce devis a été signé par le client."
              : "Partagez ce lien : le client signe en un clic, sans compte."}
          </p>
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
    </article>
  );
}
