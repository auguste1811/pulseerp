#!/bin/bash

echo "=== Configuration PulseERP ==="

echo "URL du site (ex: https://pulseerp.vercel.app)"
read APP_URL

echo "AUTH_SECRET"
read AUTH_SECRET

echo "DATABASE_URL"
read DATABASE_URL

echo "STRIPE_SECRET_KEY"
read STRIPE_SECRET_KEY

echo "STRIPE_PRICE_STARTER"
read STRIPE_PRICE_STARTER

echo "STRIPE_PRICE_PRO"
read STRIPE_PRICE_PRO

echo "STRIPE_PRICE_BUSINESS"
read STRIPE_PRICE_BUSINESS

echo "STRIPE_BILLING_WEBHOOK_SECRET"
read STRIPE_BILLING_WEBHOOK_SECRET

vars=(
AUTH_SECRET
DATABASE_URL
APP_URL
STRIPE_SECRET_KEY
STRIPE_PRICE_STARTER
STRIPE_PRICE_PRO
STRIPE_PRICE_BUSINESS
STRIPE_BILLING_WEBHOOK_SECRET
)

for ENV in production preview development
do
    echo "Configuration $ENV..."

    for VAR in "${vars[@]}"
    do
        npx vercel env rm $VAR $ENV -y >/dev/null 2>&1

        VALUE=$(eval echo \$$VAR)

        echo "$VALUE" | npx vercel env add $VAR $ENV
    done
done

echo ""
echo "Toutes les variables ont été ajoutées."
echo ""

npx vercel --prod
