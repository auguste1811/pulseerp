import { createHmac, timingSafeEqual } from "node:crypto";

function shareSecret() {
  const secret = process.env.INVOICE_SHARE_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "INVOICE_SHARE_SECRET ou AUTH_SECRET doit être configuré.",
    );
  }
  return secret;
}

export function createInvoiceShareToken(
  invoiceId: string,
  companyId: string,
) {
  return createHmac("sha256", shareSecret())
    .update(`${invoiceId}:${companyId}`)
    .digest("base64url");
}

export function verifyInvoiceShareToken(
  token: string,
  invoiceId: string,
  companyId: string,
) {
  const expected = createInvoiceShareToken(invoiceId, companyId);
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function applicationBaseUrl() {
  const configured =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL;

  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function buildPublicInvoiceUrl(
  invoiceId: string,
  companyId: string,
) {
  const token = createInvoiceShareToken(invoiceId, companyId);
  return `${applicationBaseUrl()}/api/public/invoices/${encodeURIComponent(invoiceId)}/pdf?token=${encodeURIComponent(token)}`;
}
