import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { createOpenAIResponse, extractResponseText } from "@/lib/openai-responses";
import { prisma } from "@/lib/prisma";

const categories = ["TO_CLASSIFY","PURCHASES","SUPPLIES","SOFTWARE","TELECOM","VEHICLE","TRAVEL","ADVERTISING","INSURANCE","BANK","RENT","OTHER"];
const accounts: Record<string,string> = {PURCHASES:"607000",SUPPLIES:"606300",SOFTWARE:"615600",TELECOM:"626000",VEHICLE:"625100",TRAVEL:"625100",ADVERTISING:"623000",INSURANCE:"616000",BANK:"627000",RENT:"613200",OTHER:"658000",TO_CLASSIFY:"471000"};

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const invoice = await prisma.purchaseInvoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  try {
    const dataUrl = `data:${invoice.mimeType};base64,${Buffer.from(invoice.fileData).toString("base64")}`;
    const fileContent = invoice.mimeType === "application/pdf"
      ? { type: "input_file", filename: invoice.originalName, file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl, detail: "high" };

    const response = await createOpenAIResponse({
      instructions: "Analyse cette facture française. Retourne uniquement les informations visibles. N’invente aucune valeur.",
      input: [{ role: "user", content: [fileContent, { type: "input_text", text: "Extrais le fournisseur, le numéro, les dates, HT, TVA, TTC et propose une catégorie." }] }],
      text: { format: { type: "json_schema", name: "purchase_invoice", strict: true, schema: {
        type: "object", additionalProperties: false,
        properties: {
          supplierName: { type: "string" }, invoiceNumber: { type: ["string","null"] },
          issueDate: { type: ["string","null"], description: "YYYY-MM-DD" }, dueDate: { type: ["string","null"], description: "YYYY-MM-DD" },
          subtotal: { type: "number" }, vatAmount: { type: "number" }, total: { type: "number" },
          category: { type: "string", enum: categories }, confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["supplierName","invoiceNumber","issueDate","dueDate","subtotal","vatAmount","total","category","confidence"]
      } } }
    });
    const extracted = JSON.parse(extractResponseText(response));
    const category = categories.includes(extracted.category) ? extracted.category : "TO_CLASSIFY";
    const issueDate = extracted.issueDate ? new Date(extracted.issueDate) : invoice.issueDate;
    const dueDate = extracted.dueDate ? new Date(extracted.dueDate) : invoice.dueDate;
    const subtotal = Math.max(0, Number(extracted.subtotal || 0));
    const vatAmount = Math.max(0, Number(extracted.vatAmount || 0));
    const total = Math.max(0, Number(extracted.total || subtotal + vatAmount));
    const vatRate = subtotal > 0 ? vatAmount / subtotal * 100 : 0;
    const label = `${extracted.supplierName || invoice.supplierName}${extracted.invoiceNumber ? ` — ${extracted.invoiceNumber}` : ""}`;

    await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoice.update({ where: { id }, data: {
        supplierName: extracted.supplierName || invoice.supplierName,
        invoiceNumber: extracted.invoiceNumber || invoice.invoiceNumber,
        issueDate, dueDate, category, subtotal, vatAmount, total,
        notes: `${invoice.notes || ""}${invoice.notes ? "\n" : ""}Analyse PulseAI — confiance ${Math.round(Number(extracted.confidence || 0)*100)} %`,
      }});
      await tx.transaction.updateMany({ where: { purchaseInvoiceId: id, companyId: session.companyId }, data: {
        date: issueDate, label: `Facture achat — ${extracted.supplierName || invoice.supplierName}`, category,
        amountExcludingTax: subtotal, vatRate, vatAmount, amountIncludingTax: total,
      }});
      await tx.accountingEntry.updateMany({ where: { purchaseInvoiceId: id, accountNumber: { not: "445660" }, debit: { gt: 0 } }, data: { accountNumber: accounts[category], label, debit: subtotal, entryDate: issueDate } });
      await tx.accountingEntry.updateMany({ where: { purchaseInvoiceId: id, accountNumber: "445660" }, data: { label, debit: vatAmount, entryDate: issueDate } });
      await tx.accountingEntry.updateMany({ where: { purchaseInvoiceId: id, accountNumber: "401000" }, data: { label, credit: total, entryDate: issueDate } });
    });

    return NextResponse.json({ ok: true, extracted });
  } catch (error) {
    console.error("Invoice AI analysis", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse impossible" }, { status: 500 });
  }
}
