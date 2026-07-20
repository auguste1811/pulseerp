# PulseERP v1.1.0 — App Center

## Connecteurs fonctionnels

- Google Calendar OAuth 2.0
- Import des événements Google vers PulseERP
- Microsoft 365 OAuth 2.0
- Import des événements Outlook vers PulseERP
- Connexion et validation d'une clé Stripe
- Configuration d'un projet Bridge Banking
- Déconnexion des intégrations
- Statut, compte, dernière synchronisation et erreurs
- Chiffrement AES-256-GCM des jetons et clés

## Connecteurs présentés mais non activés

- Google Drive
- Slack

## Installation

```bash
npm run setup
rm -rf .next
npm run dev
```

Configurer les identifiants OAuth dans `.env` avant de connecter Google ou
Microsoft. Les URI de redirection doivent correspondre exactement à celles
déclarées dans Google Cloud et Microsoft Entra.
