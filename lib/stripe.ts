import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY est absente.");
  }

  if (!client) {
    client = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }

  return client;
}

export function publicAppUrl(): string {
  const value =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  return value.replace(/\/$/, "");
}
