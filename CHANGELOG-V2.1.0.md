# PulseERP v2.1.0 — Prisma Foundation

- Suppression du script monolithique `scripts/setup-db.ts`
- Ajout de Prisma ORM 6.18
- Migration initiale PostgreSQL/Neon
- Schéma Prisma complet des modules existants
- Seed idempotent avec compte de démonstration
- Client Prisma réutilisable dans `lib/prisma.ts`
- Commandes de migration compatibles Vercel
- Conservation de l'authentification et des modules existants pour éviter une rupture fonctionnelle

La migration vers Auth.js sera réalisée dans le prochain lot après validation de
la base Prisma, afin de ne pas modifier simultanément la base et les sessions.
