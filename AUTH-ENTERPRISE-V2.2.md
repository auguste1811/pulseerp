# PulseERP v2.2.0 — Auth Enterprise

## Installation

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Secret Auth.js

```bash
npm run auth:secret
```

Copier la valeur obtenue dans `.env` et dans Vercel sous `AUTH_SECRET`.

## URLs OAuth locales

Google :

```text
http://localhost:3000/api/auth/callback/google
```

Microsoft :

```text
http://localhost:3000/api/auth/callback/microsoft-entra-id
```

GitHub :

```text
http://localhost:3000/api/auth/callback/github
```

En production, remplacer `http://localhost:3000` par le domaine Vercel.

## Variables minimales

```env
DATABASE_URL="URL_NEON"
AUTH_SECRET="SECRET_LONG"
AUTH_URL="http://localhost:3000"
```

Les fournisseurs OAuth sont facultatifs : les boutons ne s’affichent que
lorsque leurs identifiants sont configurés.

## Réinitialisation du mot de passe

Avec `RESEND_API_KEY`, le lien est envoyé par email. Sans clé Resend, le
contenu de l’email et le lien sont écrits dans le terminal de développement.

## Compte de démonstration

```text
demo@pulseerp.fr
Pulse123!
```
