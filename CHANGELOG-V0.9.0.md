# PulseERP v0.9.0 — Centre d'automatisation

## Fonctionnalités

- Création de workflows
- Activation et désactivation
- Suppression
- Conditions simples
- Actions :
  - créer une tâche
  - créer une notification
  - ajouter une note CRM
  - modifier le statut CRM
  - appeler un webhook
- Test manuel
- Historique d'exécution
- Journal détaillé
- Bibliothèque de modèles
- Déclencheurs internes :
  - nouveau contact
  - changement de statut CRM
  - création de facture
  - facture payée
  - création de tâche
- Isolation multi-entreprises
- Interpolation de variables `{{...}}`

## Installation

```bash
npm run setup
rm -rf .next
npm run dev
```

## Accès

```text
http://localhost:3000/automations
```

## Limites actuelles

Cette version exécute les automatisations lors des événements internes et via
le bouton de test. Les automatisations planifiées par heure ou par jour
nécessiteront un worker/cron en production.
