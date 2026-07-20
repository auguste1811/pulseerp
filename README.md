# PulseERP v2.1 — Prisma Foundation

Cette version remplace le script SQL `setup-db.ts` par des migrations Prisma.
L'application existante continue de fonctionner avec les requêtes PostgreSQL
actuelles, tandis que les prochains modules peuvent utiliser `lib/prisma.ts`.

## Installation locale

```bash
npm install
cp .env.example .env
npm run setup
npm run dev
```

## Neon + Vercel

1. Placez l'URL Neon dans `DATABASE_URL` sur le PC et dans Vercel.
2. Lancez localement `npm run setup` une seule fois pour initialiser Neon.
3. Sur Vercel, la commande de build reste `npm run build`.

## Commandes base de données

```bash
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Compte de démonstration

- Email : `demo@pulseerp.fr`
- Mot de passe : `Pulse123!`

## Important

Le fichier `.env` ne doit jamais être envoyé sur GitHub.
