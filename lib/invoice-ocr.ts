import { z } from "zod";

export const purchaseCategories = [
  "TO_CLASSIFY",
  "PURCHASES",
  "SUPPLIES",
  "SOFTWARE",
  "TELECOM",
  "VEHICLE",
  "TRAVEL",
  "ADVERTISING",
  "INSURANCE",
  "BANK",
  "RENT",
  "OTHER",
] as const;

export const categoryLabels: Record<(typeof purchaseCategories)[number], string> = {
  TO_CLASSIFY: "À classer",
  PURCHASES: "Achats",
  SUPPLIES: "Fournitures",
  SOFTWARE: "Logiciels",
  TELECOM: "Télécom",
  VEHICLE: "Véhicule",
  TRAVEL: "Déplacements",
  ADVERTISING: "Publicité",
  INSURANCE: "Assurance",
  BANK: "Banque",
  RENT: "Loyer",
  OTHER: "Divers",
};

export const expenseAccounts: Record<(typeof purchaseCategories)[number], string> = {
  PURCHASES: "607000",
  SUPPLIES: "606300",
  SOFTWARE: "615600",
  TELECOM: "626000",
  VEHICLE: "625100",
  TRAVEL: "625100",
  ADVERTISING: "623000",
  INSURANCE: "616000",
  BANK: "627000",
  RENT: "613200",
  OTHER: "658000",
  TO_CLASSIFY: "471000",
};

export const ocrInvoiceSchema = z.object({
  supplierName: z.string().trim().min(1),
  supplierAddress: z.string().trim().nullable(),
  supplierVatNumber: z.string().trim().nullable(),
  supplierSiret: z.string().trim().nullable(),
  invoiceNumber: z.string().trim().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  currency: z.string().trim().length(3).default("EUR"),
  subtotal: z.number().nonnegative(),
  vatAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  vatRate: z.number().nonnegative().max(100).nullable(),
  category: z.enum(purchaseCategories),
  paymentReference: z.string().trim().nullable(),
  iban: z.string().trim().nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export type OcrInvoiceData = z.infer<typeof ocrInvoiceSchema>;

export function safeDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateInputValue(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return "";
}
