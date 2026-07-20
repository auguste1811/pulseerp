# PulseERP v0.5.0 — Calendrier & Relances

## Nouveautés

- Vue calendrier mensuelle
- Création de rendez-vous, appels, relances et échéances
- Association d'un événement à un contact CRM
- Historique automatique dans la fiche CRM
- Modification et suppression des événements
- Statuts planifié, terminé et annulé
- Rappels configurables
- Lieu et description
- Liste des prochains événements
- Widget agenda dans le tableau de bord
- Isolation multi-entreprises

## Installation

Copier les fichiers par-dessus le projet actuel, puis :

```bash
npm run setup
rm -rf .next
npm run dev
```

## Accès

```text
http://localhost:3000/calendar
```

## Tests recommandés

1. Créer un rendez-vous lié à un contact.
2. Vérifier son apparition dans le calendrier.
3. Ouvrir la fiche contact et vérifier l'historique.
4. Modifier les dates.
5. Marquer l'événement comme terminé.
6. Vérifier le widget du dashboard.
