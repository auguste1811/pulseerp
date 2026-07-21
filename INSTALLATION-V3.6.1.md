# Installation PulseERP v3.6.1

Cette archive utilise exclusivement le registre public npm. Elle ne contient ni `.env`, ni secrets, ni configuration Vercel locale.

## Version recommandée

- Node.js 22 LTS recommandé
- Node.js 22 à 26 accepté
- npm 10 ou 11

## Installation propre

```bash
rm -rf node_modules .next
npm cache verify
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

Puis :

```bash
git add .
git commit -m "fix: installation npm stable v3.6.1"
git push origin main
```

Si une erreur `ECONNRESET` apparaît encore, elle provient de la connexion réseau. Vérifier :

```bash
npm config get registry
```

Le résultat attendu est `https://registry.npmjs.org/`.
