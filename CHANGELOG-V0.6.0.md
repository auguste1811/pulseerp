# PulseERP v0.6.0 — Gestion documentaire

## Nouveautés

- Dépôt de fichiers sécurisé
- PDF, images, Word, Excel, CSV et texte
- Limite de 15 Mo
- Classement par catégorie
- Association à un contact CRM
- Historique CRM lors de l'ajout
- Recherche par nom, fichier ou notes
- Filtre par catégorie
- Téléchargement protégé par session et entreprise
- Suppression du fichier et de ses métadonnées
- Statistiques de stockage
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
http://localhost:3000/documents
```

## Important pour la production

Cette version stocke les fichiers sur le disque local dans :

```text
storage/uploads/
```

Pour une mise en production multi-serveurs, remplacer ce stockage par
Amazon S3, Cloudflare R2, Scaleway Object Storage ou un service compatible S3.
