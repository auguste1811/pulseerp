# PulseERP v0.7.3 — Équipe isolée et professionnelle

## Correction principale

La page Équipe utilise désormais un CSS Module isolé. Les anciennes règles de
`globals.css` ne peuvent plus déformer le tableau ou supprimer la mise en page.

## Interface

- Cartes statistiques professionnelles
- Tableau aligné et lisible
- Recherche instantanée
- Filtres Tous / Actifs / Désactivés
- Badges par rôle
- Indicateur de statut
- Barre de progression des tâches
- Menu d'actions
- Fenêtre modale d'invitation
- Responsive tablette et mobile

## Installation

Copier le contenu du ZIP par-dessus le projet, puis :

```bash
rm -rf .next
npm run dev
```

Aucune migration SQL n'est nécessaire.
