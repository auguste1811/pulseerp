import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  createOpenAIResponse,
  extractResponseText,
} from "@/lib/openai-responses";
import {
  ocrInvoiceSchema,
  purchaseCategories,
} from "@/lib/invoice-ocr";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: {
      id,
      companyId: session.companyId,
    },
  });

  if (!invoice) {
    return NextResponse.json(
      { error: "Facture introuvable" },
      { status: 404 },
    );
  }

  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      invoice.mimeType,
    )
  ) {
    return NextResponse.json(
      { error: "Format non compatible avec l’analyse OCR." },
      { status: 415 },
    );
  }

  await prisma.purchaseInvoice.update({
    where: { id },
    data: {
      ocrStatus: "PROCESSING",
      ocrError: null,
    },
  });

  try {
    const dataUrl = `data:${invoice.mimeType};base64,${Buffer.from(
      invoice.fileData,
    ).toString("base64")}`;

    const documentContent =
      invoice.mimeType === "application/pdf"
        ? {
            type: "input_file",
            filename: invoice.originalName,
            file_data: dataUrl,
          }
        : {
            type: "input_image",
            image_url: dataUrl,
            detail: "high",
          };

    const response = await createOpenAIResponse({
      model: process.env.OPENAI_OCR_MODEL || process.env.OPENAI_MODEL,
      instructions: [
        "Tu es un moteur OCR comptable pour des factures fournisseurs françaises et européennes.",
        "Lis uniquement les informations réellement visibles dans le document.",
        "N’invente jamais une valeur absente ou illisible.",
        "Les montants doivent être retournés en nombres décimaux, sans symbole monétaire.",
        "Les dates doivent utiliser le format YYYY-MM-DD.",
        "Si plusieurs taux de TVA existent, additionne les montants de TVA et utilise null pour vatRate.",
        "Le total doit correspondre au TTC visible.",
        "Ajoute un avertissement pour chaque incohérence, valeur ambiguë ou information manquante.",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            documentContent,
            {
              type: "input_text",
              text: [
                "Extrais les informations structurées de cette facture.",
                "Propose aussi la catégorie comptable la plus probable parmi :",
                purchaseCategories.join(", "),
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "purchase_invoice_ocr",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              supplierName: { type: "string" },
              supplierAddress: { type: ["string", "null"] },
              supplierVatNumber: { type: ["string", "null"] },
              supplierSiret: { type: ["string", "null"] },
              invoiceNumber: { type: ["string", "null"] },
              issueDate: {
                type: ["string", "null"],
                description: "YYYY-MM-DD",
              },
              dueDate: {
                type: ["string", "null"],
                description: "YYYY-MM-DD",
              },
              currency: { type: "string" },
              subtotal: { type: "number", minimum: 0 },
              vatAmount: { type: "number", minimum: 0 },
              total: { type: "number", minimum: 0 },
              vatRate: {
                type: ["number", "null"],
                minimum: 0,
                maximum: 100,
              },
              category: {
                type: "string",
                enum: purchaseCategories,
              },
              paymentReference: { type: ["string", "null"] },
              iban: { type: ["string", "null"] },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              warnings: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "supplierName",
              "supplierAddress",
              "supplierVatNumber",
              "supplierSiret",
              "invoiceNumber",
              "issueDate",
              "dueDate",
              "currency",
              "subtotal",
              "vatAmount",
              "total",
              "vatRate",
              "category",
              "paymentReference",
              "iban",
              "confidence",
              "warnings",
            ],
          },
        },
      },
    });

    const parsed = ocrInvoiceSchema.parse(
      JSON.parse(extractResponseText(response)),
    );

    await prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ocrStatus: "READY",
        ocrConfidence: parsed.confidence,
        ocrData: parsed,
        ocrError: null,
        ocrAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      redirectTo: `/transactions/ocr/${id}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analyse OCR impossible";

    console.error("Purchase invoice OCR", error);

    await prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ocrStatus: "ERROR",
        ocrError: message.slice(0, 1500),
        ocrAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
