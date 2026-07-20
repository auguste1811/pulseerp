# PulseERP CRM CSV v0.2.1

## Fonctionnalités

- Import CSV jusqu'à 2 Mo et 5 000 lignes
- Séparateurs virgule et point-virgule
- Colonnes françaises ou anglaises
- Validation de chaque ligne
- Doublons détectés par email au sein de l'entreprise
- Mise à jour des doublons existants
- Résumé des contacts ajoutés, mis à jour et rejetés
- Modèle téléchargeable depuis la page CRM

## Colonnes recommandées

```csv
prenom;nom;entreprise;email;telephone;source;statut;valeur
```

Les colonnes `prenom` et `nom` sont obligatoires.

## Installation

Copier les fichiers par-dessus le projet actuel, puis :

```bash
rm -rf .next
npm run dev
```

Aucune migration SQL et aucune dépendance npm supplémentaire ne sont nécessaires.
