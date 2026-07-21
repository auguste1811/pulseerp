import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicAppUrl, stripeClient } from "@/lib/stripe";
import {
  stripeConnection,
  type StripeConnectionSettings,
} from "@/lib/stripe-connect";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const member = await currentContext();
  const { id } = await context.params;

  const invoices = await query<any>(
    `
    SELECT d.*, c.email AS customer_email,
           c.company_name, c.first_name, c.last_name
    FROM sales_documents d
    LEFT JOIN contacts c ON c.id=d.contact_id
    WHERE d.id=$1 AND d.company_id=$2
      AND d.document_type='INVOICE'
    LIMIT 1
    `,
    [id, member.company_id],
  );
  const invoice = invoices[0];

  if (!invoice || invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return NextResponse.redirect(`${publicAppUrl()}/billing/${id}?payment=unavailable`, 303);
  }

  const connection = await stripeConnection(member.company_id);
  const settings = (connection?.settings || {}) as StripeConnectionSettings;

  if (!settings.accountId || !settings.chargesEnabled) {
    return NextResponse.redirect(`${publicAppUrl()}/integrations?error=stripe_not_ready`, 303);
  }

  const amount = Math.round(Number(invoice.total) * 100);
  if (!Number.isFinite(amount) || amount < 50) {
    return NextResponse.redirect(`${publicAppUrl()}/billing/${id}?payment=amount`, 303);
  }

  const baseUrl = publicAppUrl();
  const customerName =
    invoice.company_name ||
    `${invoice.first_name || ""} ${invoice.last_name || ""}`.trim();

  const session = await stripeClient().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: invoice.customer_email || undefined,
      success_url: `${baseUrl}/billing/${id}?payment=success`,
      cancel_url: `${baseUrl}/billing/${id}?payment=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(invoice.currency || "EUR").toLowerCase(),
            unit_amount: amount,
            product_data: {
              name: `Facture ${invoice.document_number}`,
              description: customerName ? `Client : ${customerName}` : undefined,
            },
          },
        },
      ],
      metadata: {
        pulseerpCompanyId: member.company_id,
        pulseerpDocumentId: invoice.id,
        pulseerpDocumentNumber: invoice.document_number,
      },
      payment_intent_data: {
        metadata: {
          pulseerpCompanyId: member.company_id,
          pulseerpDocumentId: invoice.id,
        },
      },
    },
    { stripeAccount: settings.accountId },
  );

  if (!session.url) {
    return NextResponse.redirect(`${baseUrl}/billing/${id}?payment=error`, 303);
  }

  return NextResponse.redirect(session.url, 303);
}
