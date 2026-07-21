# PulseERP v3.5.2

- Suppression de la connexion Auth.js automatique après l’inscription.
- Redirection fiable vers `/login?created=1`.
- Compatibilité `AUTH_SECRET`, `NEXTAUTH_SECRET` et `JWT_SECRET`.
- Ajout du diagnostic sécurisé `/api/health/config`.
- Vérification de la connexion Neon.
- Vérification de l’existence de la table `subscriptions`.
- Ajout d’un script sécurisé de configuration Vercel.
