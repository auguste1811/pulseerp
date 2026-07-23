"use client";

import { useMemo, useState } from "react";

function whatsappNumber(phone: string) {
  return phone.replace(/\D/g, "");
}

export function InvoiceMessageShare({
  invoiceNumber,
  clientName,
  phone,
  publicUrl,
  issuerName,
}: {
  invoiceNumber: string;
  clientName: string;
  phone: string;
  publicUrl: string;
  issuerName: string;
}) {
  const defaultMessage = `Bonjour ${clientName || ""},\n\nVous pouvez consulter et télécharger votre facture ${invoiceNumber} en cliquant sur le lien suivant :\n${publicUrl}\n\nNous restons à votre disposition pour toute question.\n\n${issuerName}`;
  const [message, setMessage] = useState(defaultMessage);
  const normalizedPhone = phone.trim();

  const links = useMemo(() => {
    const encoded = encodeURIComponent(message);
    const waNumber = whatsappNumber(normalizedPhone);

    return {
      sms: normalizedPhone
        ? `sms:${normalizedPhone}?body=${encoded}`
        : "",
      whatsapp: waNumber
        ? `https://wa.me/${waNumber}?text=${encoded}`
        : "",
    };
  }, [message, normalizedPhone]);

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
  }

  return (
    <article className="dashboard-panel invoice-message-card">
      <div className="panel-header">
        <div>
          <h2>Envoyer par message</h2>
          <p>Partagez un lien PDF sécurisé par SMS ou WhatsApp.</p>
        </div>
      </div>

      {!normalizedPhone && (
        <div className="invoice-email-warning">
          Ajoutez d’abord un numéro de téléphone dans la fiche du client.
        </div>
      )}

      <div className="premium-form invoice-message-form">
        <label>
          Numéro du client
          <input value={normalizedPhone} readOnly placeholder="Non renseigné" />
        </label>

        <label>
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={9}
          />
        </label>

        <div className="invoice-message-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={copyMessage}
          >
            Copier le message
          </button>

          <a
            className={`secondary-action sms-action ${!links.sms ? "disabled" : ""}`}
            href={links.sms || undefined}
            aria-disabled={!links.sms}
          >
            Envoyer par SMS
          </a>

          <a
            className={`primary-action whatsapp-action ${!links.whatsapp ? "disabled" : ""}`}
            href={links.whatsapp || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!links.whatsapp}
          >
            Envoyer par WhatsApp
          </a>
        </div>
      </div>

      <small className="invoice-message-note">
        PulseERP ouvre l’application choisie avec le message prérempli. Vous
        gardez la validation finale avant l’envoi.
      </small>
    </article>
  );
}
