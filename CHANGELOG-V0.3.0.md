# PulseERP v0.3.0 — CRM Pro

## Nouveautés

- Pipeline commercial Kanban avec glisser-déposer
- Fiche client individuelle
- Modification complète des coordonnées
- Adresse, SIRET, TVA, priorité et tags
- Notes internes
- Timeline d'activités
- Enregistrement des appels, emails, rendez-vous et relances
- Historique automatique des créations, modifications et changements d'étape
- Suppression sécurisée par entreprise
- Statistiques CRM
- Import CSV conservé
- Détection des doublons CSV conservée
- Isolation multi-entreprises sur toutes les nouvelles actions

## Installation

Copier les fichiers par-dessus le projet actuel, puis lancer :

```bash
npm run setup
rm -rf .next
npm run dev
```

La commande `npm run setup` ajoute les nouvelles colonnes et tables sans supprimer
les contacts existants.

## Tests recommandés

1. Créer un contact.
2. Ouvrir sa fiche.
3. Ajouter une note.
4. Ajouter une activité.
5. Modifier son statut et ses tags.
6. Aller sur `/contacts/pipeline`.
7. Déplacer le contact dans une autre colonne.
8. Vérifier l'historique.
9. Importer un CSV existant.
