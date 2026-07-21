import { prisma } from "@/lib/prisma";

export async function companyAIContext(companyId: string) {
  const [company, contacts, documents, transactions, purchases, tasks] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          currency: true,
          defaultVatRate: true,
          country: true,
        },
      }),
      prisma.contact.findMany({
        where: { companyId },
        orderBy: { value: "desc" },
        take: 12,
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          status: true,
          value: true,
          source: true,
        },
      }),
      prisma.salesDocument.findMany({
        where: { companyId },
        orderBy: { issueDate: "desc" },
        take: 20,
        select: {
          documentType: true,
          documentNumber: true,
          status: true,
          issueDate: true,
          dueDate: true,
          subtotal: true,
          vatAmount: true,
          total: true,
        },
      }),
      prisma.transaction.findMany({
        where: { companyId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 80,
        select: {
          type: true,
          status: true,
          date: true,
          label: true,
          category: true,
          amountExcludingTax: true,
          vatAmount: true,
          amountIncludingTax: true,
        },
      }),
      prisma.purchaseInvoice.findMany({
        where: { companyId },
        orderBy: { issueDate: "desc" },
        take: 20,
        select: {
          supplierName: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          category: true,
          status: true,
          subtotal: true,
          vatAmount: true,
          total: true,
        },
      }),
      prisma.task.findMany({
        where: { companyId, status: { not: "DONE" } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 20,
        select: { title: true, status: true, priority: true, dueDate: true },
      }),
    ]);

  const normalize = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value, (_, item) =>
        typeof item === "object" && item !== null && "toNumber" in item
          ? (item as { toNumber(): number }).toNumber()
          : item,
      ),
    );

  return normalize({ company, contacts, documents, transactions, purchases, tasks });
}
