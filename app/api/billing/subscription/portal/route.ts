import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const member = await currentContext({ allowExpired: true });

  if (!["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { companyId: member.company_id },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.redirect(
      new URL("/subscribe?error=no-customer", request.url),
      303,
    );
  }

  const baseUrl =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;

  const portal = await stripeClient().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}/subscribe`,
  });

  return NextResponse.redirect(portal.url, 303);
}
