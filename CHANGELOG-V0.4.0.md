# PulseERP v0.4.0 — Devis & Facturation

## Nouveautés

- Création de devis et factures
- Numérotation automatique annuelle
- Association aux contacts CRM
- Lignes de produits et prestations
- Calcul automatique HT, TVA et TTC
- Ajout de lignes après création
- Gestion des statuts
- Conversion devis vers facture
- Suivi des montants encaissés et à recevoir
- Page imprimable propre
- Enregistrement PDF via l'impression du navigateur
- Historique CRM lors de la création d'un document
- Suppression des brouillons
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
http://localhost:3000/billing
```

## Test recommandé

1. Créer un contact CRM.
2. Créer un devis.
3. Ajouter une deuxième ligne.
4. Modifier son statut.
5. Ouvrir la version imprimable.
6. Enregistrer en PDF.
7. Convertir le devis en facture.
8. Marquer la facture comme payée.
