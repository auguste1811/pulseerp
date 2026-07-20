# PulseERP v1.0.0 Premium

## Modules inclus

- Authentification et multi-entreprises
- Dashboard dirigeant
- CRM Pro avec pipeline
- Import CSV
- Devis et factures
- Calendrier et relances
- Tâches et attribution
- Gestion documentaire
- Équipe et permissions
- Paramètres entreprise
- Centre d'automatisation
- Historique d'exécution
- Notifications internes
- Rapports financiers, CRM et automatisations

## Automatisations fonctionnelles

- Nouveau contact
- Changement de statut CRM
- Facture créée
- Facture payée
- Facture en retard
- Tâche créée ou terminée
- Document ajouté
- Exécution manuelle

## Actions disponibles

- Créer une tâche
- Créer une notification
- Ajouter une note CRM
- Modifier un statut CRM
- Appeler un webhook

## Installation

```bash
npm install
npm run setup
rm -rf .next
npm run dev
```

## Accès principaux

- `/dashboard`
- `/contacts`
- `/billing`
- `/calendar`
- `/documents`
- `/team`
- `/reports`
- `/automations`
- `/notifications`
- `/settings`

## Limites avant production publique

Cette version est une base Premium fonctionnelle pour test et démonstration.
Avant une commercialisation publique, prévoir des tests automatisés, un
service email transactionnel, un stockage objet, une file de jobs, des
sauvegardes externes et un audit de sécurité.
