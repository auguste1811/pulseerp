# PulseERP v0.7.0 — Équipe & Permissions

## Nouveautés

- Ajout de collaborateurs
- Rôles : propriétaire, administrateur, manager, employé, lecture seule
- Activation et désactivation des comptes
- Retrait d'un membre d'une entreprise
- Protection des actions d'administration
- Liste des membres et dernières connexions
- Statistiques d'équipe
- Attribution des tâches aux collaborateurs
- Affichage de l'assignation dans le Kanban
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
http://localhost:3000/team
```

## Sécurité

Seuls les rôles OWNER et ADMIN peuvent gérer les membres.

## Test recommandé

1. Ajouter un collaborateur.
2. Se connecter avec son compte temporaire.
3. Vérifier son accès.
4. Lui attribuer une tâche.
5. Modifier son rôle.
6. Désactiver puis réactiver son compte.
