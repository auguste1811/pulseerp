import { query } from "@/lib/db";

export type InvoiceEmailItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
};

export type InvoiceEmailData = {
  id: string;
  companyId: string;
  documentNumber: string;
  documentType: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string | null;
  currency: string;
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    siret: string | null;
    vatNumber: string | null;
  };
  issuer: {
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
    siret: string | null;
    vatNumber: string | null;
    iban: string | null;
    bic: string | null;
    footer: string | null;
  };
  items: InvoiceEmailItem[];
};

export async function loadInvoiceEmailData(
  documentId: string,
  companyId: string,
): Promise<InvoiceEmailData | null> {
  const [documents, items] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name,
             c.email, c.phone, c.address, c.siret, c.vat_number,
             co.name AS issuer_name,
             co.legal_name AS issuer_legal_name,
             co.address AS issuer_address,
             co.postal_code AS issuer_postal_code,
             co.city AS issuer_city,
             co.country AS issuer_country,
             co.email AS issuer_email,
             co.phone AS issuer_phone,
             co.siret AS issuer_siret,
             co.vat_number AS issuer_vat_number,
             co.iban AS issuer_iban,
             co.bic AS issuer_bic,
             co.invoice_footer AS issuer_footer
      FROM sales_documents d
      JOIN companies co ON co.id = d.company_id
      LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.id=$1 AND d.company_id=$2
      LIMIT 1
      `,
      [documentId, companyId],
    ),
    query<any>(
      `
      SELECT description, quantity, unit_price, vat_rate, line_total
      FROM sales_document_items
      WHERE document_id=$1
      ORDER BY position, id
      `,
      [documentId],
    ),
  ]);

  const document = documents[0];
  if (!document) return null;

  const clientName =
    document.company_name ||
    `${document.first_name || ""} ${document.last_name || ""}`.trim() ||
    "Client";

  return {
    id: document.id,
    companyId: document.company_id,
    documentNumber: document.document_number,
    documentType: document.document_type,
    status: document.status,
    issueDate: document.issue_date,
    dueDate: document.due_date,
    currency: document.currency || "EUR",
    notes: document.notes,
    subtotal: Number(document.subtotal || 0),
    vatAmount: Number(document.vat_amount || 0),
    total: Number(document.total || 0),
    client: {
      name: clientName,
      email: document.email,
      phone: document.phone,
      address: document.address,
      siret: document.siret,
      vatNumber: document.vat_number,
    },
    issuer: {
      name: document.issuer_name,
      legalName: document.issuer_legal_name,
      email: document.issuer_email,
      phone: document.issuer_phone,
      address: document.issuer_address,
      postalCode: document.issuer_postal_code,
      city: document.issuer_city,
      country: document.issuer_country,
      siret: document.issuer_siret,
      vatNumber: document.issuer_vat_number,
      iban: document.issuer_iban,
      bic: document.issuer_bic,
      footer: document.issuer_footer,
    },
    items: items.map((item: any) => ({
      description: String(item.description || ""),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      vatRate: Number(item.vat_rate || 0),
      lineTotal: Number(item.line_total || 0),
    })),
  };
}

function ascii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/€/g, "EUR")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatMoney(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} EUR`;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function wrap(value: string, width: number): string[] {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function buildInvoicePdf(invoice: InvoiceEmailData): Buffer {
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let y = 790;

  const addLine = (text: string, size = 10, x = 48, bold = false) => {
    if (y < 55) {
      pages.push([]);
      pageIndex += 1;
      y = 790;
    }
    pages[pageIndex].push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${ascii(text)}) Tj ET`,
    );
    y -= size + 5;
  };

  addLine(invoice.issuer.legalName || invoice.issuer.name, 17, 48, true);
  addLine(`FACTURE ${invoice.documentNumber}`, 17, 335, true);
  y -= 7;

  addLine("EMETTEUR", 9, 48, true);
  addLine(invoice.issuer.address || "", 9);
  addLine(
    [invoice.issuer.postalCode, invoice.issuer.city].filter(Boolean).join(" "),
    9,
  );
  addLine(invoice.issuer.country || "", 9);
  if (invoice.issuer.email) addLine(invoice.issuer.email, 9);
  if (invoice.issuer.phone) addLine(invoice.issuer.phone, 9);
  if (invoice.issuer.siret) addLine(`SIRET : ${invoice.issuer.siret}`, 9);
  if (invoice.issuer.vatNumber) addLine(`TVA : ${invoice.issuer.vatNumber}`, 9);

  y -= 5;
  addLine("DESTINATAIRE", 9, 48, true);
  addLine(invoice.client.name, 11, 48, true);
  if (invoice.client.address) addLine(invoice.client.address, 9);
  if (invoice.client.email) addLine(invoice.client.email, 9);
  if (invoice.client.phone) addLine(invoice.client.phone, 9);
  if (invoice.client.siret) addLine(`SIRET : ${invoice.client.siret}`, 9);
  if (invoice.client.vatNumber) addLine(`TVA : ${invoice.client.vatNumber}`, 9);

  y -= 7;
  addLine(`Date d'emission : ${formatDate(invoice.issueDate)}`, 10, 48, true);
  addLine(`Date d'echeance : ${formatDate(invoice.dueDate)}`, 10, 48, true);
  addLine(`Statut : ${invoice.status}`, 10, 48, true);

  y -= 10;
  addLine("DESCRIPTION", 9, 48, true);
  addLine("QTE", 9, 330, true);
  addLine("PU HT", 9, 380, true);
  addLine("TVA", 9, 455, true);
  addLine("TOTAL TTC", 9, 500, true);
  y -= 3;

  for (const item of invoice.items) {
    const lines = wrap(item.description, 46);
    const firstY = y;
    lines.forEach((line, index) => addLine(line, 8, 48, index === 0));
    const rowHeight = Math.max(13, lines.length * 13);
    pages[pageIndex].push(
      `BT /F1 8 Tf 1 0 0 1 330 ${firstY} Tm (${ascii(item.quantity.toLocaleString("fr-FR"))}) Tj ET`,
      `BT /F1 8 Tf 1 0 0 1 380 ${firstY} Tm (${ascii(formatMoney(item.unitPrice))}) Tj ET`,
      `BT /F1 8 Tf 1 0 0 1 455 ${firstY} Tm (${ascii(`${item.vatRate}%`)}) Tj ET`,
      `BT /F2 8 Tf 1 0 0 1 500 ${firstY} Tm (${ascii(formatMoney(item.lineTotal))}) Tj ET`,
    );
    y = Math.min(y, firstY - rowHeight);
    y -= 3;
  }

  y -= 9;
  addLine(`Sous-total HT : ${formatMoney(invoice.subtotal)}`, 11, 330, true);
  addLine(`TVA : ${formatMoney(invoice.vatAmount)}`, 11, 330, true);
  addLine(`TOTAL TTC : ${formatMoney(invoice.total)}`, 14, 330, true);

  if (invoice.issuer.iban || invoice.issuer.bic) {
    y -= 10;
    addLine("COORDONNEES BANCAIRES", 9, 48, true);
    if (invoice.issuer.iban) addLine(`IBAN : ${invoice.issuer.iban}`, 9);
    if (invoice.issuer.bic) addLine(`BIC : ${invoice.issuer.bic}`, 9);
  }

  if (invoice.notes) {
    y -= 8;
    addLine("NOTES", 9, 48, true);
    for (const line of wrap(invoice.notes, 92)) addLine(line, 8);
  }

  if (invoice.issuer.footer) {
    y -= 8;
    addLine("MENTIONS", 9, 48, true);
    for (const line of wrap(invoice.issuer.footer, 92)) addLine(line, 8);
  }

  const objects: string[] = [];
  const setObject = (id: number, value: string) => {
    objects[id] = value;
  };

  setObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  setObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  setObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];
  let nextId = 5;
  for (const commands of pages) {
    const stream = commands.join("\n");
    const contentId = nextId++;
    const pageId = nextId++;
    setObject(
      contentId,
      `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
    );
    setObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  setObject(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(output, "binary");
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, "binary");
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "binary");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildInvoiceEmailHtml(
  invoice: InvoiceEmailData,
  message: string,
): string {
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  return `
  <div style="background:#f5f6fa;padding:32px 16px;font-family:Arial,sans-serif;color:#242737">
    <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e4e6ee;border-radius:16px;overflow:hidden">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#17162a,#4f3bd8);color:#fff">
        <div style="font-size:22px;font-weight:800">PulseERP</div>
        <div style="margin-top:8px;font-size:13px;opacity:.86">Facture ${escapeHtml(invoice.documentNumber)}</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 18px;line-height:1.65">Bonjour ${escapeHtml(invoice.client.name)},</p>
        <p style="margin:0 0 22px;line-height:1.65">${safeMessage}</p>
        <div style="padding:18px;border:1px solid #e7e8ef;border-radius:12px;background:#fafbfc">
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px"><span>Numéro</span><strong>${escapeHtml(invoice.documentNumber)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px"><span>Date d’émission</span><strong>${escapeHtml(formatDate(invoice.issueDate))}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px"><span>Échéance</span><strong>${escapeHtml(formatDate(invoice.dueDate))}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid #e2e4ea;font-size:18px"><span>Total TTC</span><strong>${escapeHtml(formatMoney(invoice.total))}</strong></div>
        </div>
        <p style="margin:22px 0 0;color:#737889;font-size:13px;line-height:1.6">La facture PDF est jointe à cet email.</p>
      </div>
      <div style="padding:18px 28px;background:#f7f8fb;color:#868b9a;font-size:12px">
        Envoyé par ${escapeHtml(invoice.issuer.legalName || invoice.issuer.name)} avec PulseERP.
      </div>
    </div>
  </div>`;
}

export async function sendResendEmail(input: {
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  filename: string;
  pdf: Buffer;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      reply_to: input.replyTo || undefined,
      subject: input.subject,
      html: input.html,
      attachments: [
        {
          filename: input.filename,
          content: input.pdf.toString("base64"),
          content_type: "application/pdf",
        },
      ],
      tags: [
        { name: "category", value: "invoice" },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.message || payload.name || `Resend error ${response.status}`);
  }

  return { id: payload.id };
}
