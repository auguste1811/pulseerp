import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    authSecretConfigured: Boolean(
      process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        process.env.JWT_SECRET,
    ),
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    appUrlConfigured: Boolean(
      process.env.APP_URL || process.env.AUTH_URL,
    ),
    invoiceEmailMode: "MAILTO",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripePricesConfigured: Boolean(
      process.env.STRIPE_PRICE_STARTER &&
        process.env.STRIPE_PRICE_PRO &&
        process.env.STRIPE_PRICE_BUSINESS,
    ),
    stripeBillingWebhookConfigured: Boolean(
      process.env.STRIPE_BILLING_WEBHOOK_SECRET,
    ),
    databaseReachable: false,
    subscriptionSchemaReady: false,
  };

  let databaseError: string | null = null;

  if (checks.databaseUrlConfigured) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.databaseReachable = true;

      await prisma.subscription.count();
      checks.subscriptionSchemaReady = true;
    } catch (error) {
      databaseError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Erreur de base de données inconnue";
    }
  }

  const requiredReady =
    checks.authSecretConfigured &&
    checks.databaseUrlConfigured &&
    checks.databaseReachable &&
    checks.subscriptionSchemaReady;

  return NextResponse.json(
    {
      ok: requiredReady,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      checks,
      databaseError,
      nextAction: requiredReady
        ? "La configuration minimale Auth/Neon est opérationnelle."
        : "Corrigez les contrôles à false puis créez un nouveau déploiement.",
    },
    {
      status: requiredReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
