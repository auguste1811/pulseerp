import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { query } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { saveStripeAccount } from "@/lib/stripe-connect";

export const runtime = "nodejs";

async function markInvoicePaid(session: Stripe.Checkout.Session, connectedAccount?: string) {
  const companyId = session.metadata?.pulseerpCompanyId;
  const documentId = session.metadata?.pulseerpDocumentId;
  if (!companyId || !documentId) return;

  if (connectedAccount) {
    const connection = await query<any>(
      `
      SELECT id
      FROM integration_connections
      WHERE company_id=$1 AND provider='STRIPE'
        AND settings->>'accountId'=$2
      LIMIT 1
      `,
      [companyId, connectedAccount],
    );
    if (!connection[0]) return;
  }

  await query(
    `
    UPDATE sales_documents
    SET status='PAID', updated_at=NOW()
    WHERE id=$1 AND company_id=$2 AND document_type='INVOICE'
    `,
    [documentId, companyId],
  );

  await query(
    `
    UPDATE transactions
    SET status='PAID'
    WHERE sales_document_id=$1 AND company_id=$2
    `,
    [documentId, companyId],
  );

  await query(
    `
    INSERT INTO notifications (
      id, company_id, user_id, title, message, type, is_read, created_at
    )
    SELECT
      gen_random_uuid()::text,
      d.company_id,
      cm.user_id,
      'Paiement Stripe reçu',
      'La facture ' || d.document_number || ' a été payée.',
      'SUCCESS', FALSE, NOW()
    FROM sales_documents d
    JOIN company_members cm ON cm.company_id=d.company_id
    WHERE d.id=$1 AND d.company_id=$2
      AND cm.role IN ('OWNER','ADMIN')
    ON CONFLICT DO NOTHING
    `,
    [documentId, companyId],
  );
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook Stripe non configuré" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripeClient().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Signature Stripe invalide", error);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const connection = await query<any>(
        `
        SELECT company_id, user_id
        FROM integration_connections
        WHERE provider='STRIPE' AND settings->>'accountId'=$1
        LIMIT 1
        `,
        [account.id],
      );
      if (connection[0]) {
        await saveStripeAccount({
          companyId: connection[0].company_id,
          userId: connection[0].user_id,
          account,
        });
      }
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await markInvoicePaid(session, event.account || undefined);
      }
    }
  } catch (error) {
    console.error("Traitement webhook Stripe échoué", error);
    return NextResponse.json({ error: "Traitement impossible" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
