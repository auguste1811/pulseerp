#!/usr/bin/env bash
set -euo pipefail

echo "Configuration sécurisée de PulseERP sur Vercel"
echo "Les valeurs secrètes ne seront pas affichées."

read -r -p "URL publique du site (https://...vercel.app) : " APP_URL
read -r -s -p "AUTH_SECRET : " AUTH_SECRET
echo
read -r -s -p "DATABASE_URL Neon : " DATABASE_URL
echo
read -r -s -p "STRIPE_SECRET_KEY : " STRIPE_SECRET_KEY
echo
read -r -p "STRIPE_PRICE_STARTER (price_...) : " STRIPE_PRICE_STARTER
read -r -p "STRIPE_PRICE_PRO (price_...) : " STRIPE_PRICE_PRO
read -r -p "STRIPE_PRICE_BUSINESS (price_...) : " STRIPE_PRICE_BUSINESS
read -r -s -p "STRIPE_BILLING_WEBHOOK_SECRET (whsec_...) : " STRIPE_BILLING_WEBHOOK_SECRET
echo

set_var() {
  local name="$1"
  local value="$2"
  local environment="$3"

  npx vercel env rm "$name" "$environment" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$name" "$environment" --yes
}

for environment in production preview; do
  echo "Configuration de l’environnement : $environment"

  set_var AUTH_SECRET "$AUTH_SECRET" "$environment"
  set_var DATABASE_URL "$DATABASE_URL" "$environment"
  set_var APP_URL "$APP_URL" "$environment"
  set_var AUTH_URL "$APP_URL" "$environment"
  set_var STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY" "$environment"
  set_var STRIPE_PRICE_STARTER "$STRIPE_PRICE_STARTER" "$environment"
  set_var STRIPE_PRICE_PRO "$STRIPE_PRICE_PRO" "$environment"
  set_var STRIPE_PRICE_BUSINESS "$STRIPE_PRICE_BUSINESS" "$environment"
  set_var STRIPE_BILLING_WEBHOOK_SECRET "$STRIPE_BILLING_WEBHOOK_SECRET" "$environment"
done

echo
echo "Variables enregistrées. Déploiement Production en cours..."
npx vercel --prod

echo
echo "Après le déploiement, ouvrez :"
echo "${APP_URL%/}/api/health/config"
