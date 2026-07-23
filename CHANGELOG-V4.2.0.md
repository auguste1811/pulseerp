# PulseERP v4.2.0 — Stable sans Resend

- Suppression de la dépendance Resend pour l’envoi des factures.
- Suppression de `RESEND_API_KEY` et `EMAIL_FROM` pour la facturation.
- Envoi par email via Gmail, Outlook, Apple Mail ou l’application par défaut.
- Destinataire, objet, message et lien sécurisé préremplis.
- Partage par SMS et WhatsApp conservé.
- Téléchargement PDF conservé.
- Aucune erreur 500 si une API email n’est pas configurée.
- Seul `INVOICE_SHARE_SECRET` est nécessaire pour les liens publics sécurisés.
