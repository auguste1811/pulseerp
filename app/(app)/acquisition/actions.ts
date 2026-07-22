"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentContext } from "@/lib/auth";
import { monthStart } from "@/lib/acquisition";
import { prisma } from "@/lib/prisma";

const metricSchema = z.object({
  channelId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  spend: z.coerce.number().min(0).max(100000000),
  attributedRevenue: z.coerce.number().min(0).max(100000000),
  notes: z.string().trim().max(3000).optional(),
  managerUserId: z.string().optional(),
});

export async function saveAcquisitionMetric(formData: FormData) {
  const member = await currentContext();

  const parsed = metricSchema.safeParse({
    channelId: formData.get("channelId"),
    month: formData.get("month"),
    spend: formData.get("spend") || 0,
    attributedRevenue: formData.get("attributedRevenue") || 0,
    notes: formData.get("notes") || "",
    managerUserId: formData.get("managerUserId") || "",
  });

  if (!parsed.success) {
    redirect(`/acquisition?month=${String(formData.get("month") || "")}&error=invalid`);
  }

  const channel = await prisma.acquisitionChannel.findFirst({
    where: {
      id: parsed.data.channelId,
      companyId: member.company_id,
    },
    select: { id: true },
  });

  if (!channel) redirect("/acquisition?error=channel");

  if (parsed.data.managerUserId) {
    const membership = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: parsed.data.managerUserId,
          companyId: member.company_id,
        },
      },
      select: { userId: true },
    });

    if (!membership) redirect("/acquisition?error=manager");
  }

  const month = monthStart(parsed.data.month);

  await prisma.$transaction([
    prisma.acquisitionChannel.update({
      where: { id: channel.id },
      data: {
        managerUserId: parsed.data.managerUserId || null,
      },
    }),
    prisma.acquisitionMetric.upsert({
      where: {
        channelId_month: {
          channelId: channel.id,
          month,
        },
      },
      update: {
        spend: parsed.data.spend,
        attributedRevenue: parsed.data.attributedRevenue,
        notes: parsed.data.notes || null,
      },
      create: {
        channelId: channel.id,
        month,
        spend: parsed.data.spend,
        attributedRevenue: parsed.data.attributedRevenue,
        notes: parsed.data.notes || null,
      },
    }),
  ]);

  revalidatePath("/acquisition");
  revalidatePath("/dashboard");
  redirect(`/acquisition?month=${parsed.data.month}&saved=1`);
}
