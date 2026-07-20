# Authentification PulseERP v0.1.1

## Installation

1. Copier les fichiers de ce dossier par-dessus le projet PulseERP v0.1.0.
2. Vérifier le fichier `.env`.
3. Lancer :

```bash
npm install
npm run setup
npm run dev
```

## Email et mot de passe

- `/register` crée un utilisateur, une entreprise et le rôle OWNER.
- `/login` ouvre une session JWT stockée dans un cookie HttpOnly.
- `/dashboard` reste protégé par le layout applicatif.

## Google

La connexion Google est prête mais reste inactive sans clés.

Ajouter dans `.env` :

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

Dans Google Cloud Console, enregistrer exactement cette URI de redirection.

## Avant production

- Remplacer `JWT_SECRET` par une valeur aléatoire longue.
- Utiliser HTTPS.
- Ajouter rate limiting, vérification d'email, récupération de mot de passe et MFA.
- Ne pas considérer cette version comme auditée en sécurité.
