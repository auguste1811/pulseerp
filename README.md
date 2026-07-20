# PulseERP v0.1.0

Première version fonctionnelle du SaaS PulseERP.

## Fonctionnalités
- Connexion sécurisée par cookie JWT
- Isolation des données par entreprise
- Dashboard
- CRM
- Revenus et dépenses avec TVA
- Tâches Kanban
- PostgreSQL avec pilote pg

## Installation Mac / Windows
1. Copier `.env.example` vers `.env`
2. Lancer Docker Desktop
3. `docker compose up -d db`
4. `npm install`
5. `npm run setup`
6. `npm run dev`
7. Ouvrir http://localhost:3000

Compte démo : `demo@pulseerp.fr` / `Pulse123!`

## Production
Ce projet est une V0.1.0. Avant commercialisation : MFA, validation email, récupération de mot de passe, RBAC complet, audit de sécurité, tests, stockage documentaire, sauvegardes, RGPD et Stripe Billing.
