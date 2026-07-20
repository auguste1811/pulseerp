import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Pulse123!", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@pulseerp.fr" },
    update: { isActive: true },
    create: {
      id: randomUUID(),
      firstName: "Auguste",
      lastName: "Martinat",
      email: "demo@pulseerp.fr",
      passwordHash,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const existingMembership = await prisma.companyMember.findFirst({
    where: { userId: user.id },
    include: { company: true },
  });

  let company = existingMembership?.company;

  if (!company) {
    company = await prisma.company.create({
      data: {
        id: randomUUID(),
        name: "Pulse Agency",
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });
  }

  if ((await prisma.contact.count({ where: { companyId: company.id } })) === 0) {
    await prisma.contact.createMany({
      data: [
        {
          id: randomUUID(), companyId: company.id, firstName: "Lucas",
          lastName: "Martin", companyName: "LM Conseil",
          email: "lucas@example.fr", source: "LinkedIn",
          status: "NEGOTIATION", value: 3500,
        },
        {
          id: randomUUID(), companyId: company.id, firstName: "Emma",
          lastName: "Durand", companyName: "Agence Nova",
          email: "emma@example.fr", source: "Google Ads",
          status: "CUSTOMER", value: 4800,
        },
      ],
    });
  }

  if ((await prisma.transaction.count({ where: { companyId: company.id } })) === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.transaction.createMany({
      data: [
        {
          id: randomUUID(), companyId: company.id, type: "INCOME",
          status: "PAID", date: today, label: "Contrat Agence Nova",
          category: "Vente", amountExcludingTax: 4800, vatRate: 20,
          vatAmount: 960, amountIncludingTax: 5760,
        },
        {
          id: randomUUID(), companyId: company.id, type: "EXPENSE",
          status: "PAID", date: today, label: "Google Ads",
          category: "Publicité", amountExcludingTax: 1500, vatRate: 20,
          vatAmount: 300, amountIncludingTax: 1800,
        },
      ],
    });
  }

  if ((await prisma.task.count({ where: { companyId: company.id } })) === 0) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const inThreeDays = new Date(); inThreeDays.setDate(inThreeDays.getDate() + 3);
    await prisma.task.createMany({
      data: [
        {
          id: randomUUID(), companyId: company.id,
          title: "Relancer Lucas Martin", status: "TODO",
          priority: "HIGH", dueDate: tomorrow, assignedUserId: user.id,
        },
        {
          id: randomUUID(), companyId: company.id,
          title: "Préparer le rapport mensuel", status: "IN_PROGRESS",
          priority: "MEDIUM", dueDate: inThreeDays, assignedUserId: user.id,
        },
      ],
    });
  }

  console.log("Base PulseERP v2.1 initialisée.");
  console.log("Démo : demo@pulseerp.fr / Pulse123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
