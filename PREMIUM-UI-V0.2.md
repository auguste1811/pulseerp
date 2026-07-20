# PulseERP Premium UI v0.2.0

Cette mise à jour remplace l'interface de l'espace connecté sans modifier
l'authentification ni les tables PostgreSQL.

## Installation

Copier les éléments du ZIP par-dessus le dossier PulseERP actuel, puis :

```bash
rm -rf .next
npm run dev
```

Aucune nouvelle dépendance npm n'est requise.

## Éléments remplacés

- layout applicatif
- sidebar et barre supérieure
- dashboard
- CRM
- comptabilité
- tâches
- feuille de styles globale

## Commit recommandé

```bash
git add .
git commit -m "feat: premium UI v0.2.0"
```
