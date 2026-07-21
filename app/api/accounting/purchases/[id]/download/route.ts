import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.companyId) return new NextResponse("Non autorisé", { status: 401 });

  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, companyId: session.user.companyId },
    select: { fileData: true, mimeType: true, originalName: true },
  });
  if (!invoice) return new NextResponse("Introuvable", { status: 404 });

  return new NextResponse(invoice.fileData, {
    headers: {
      "Content-Type": invoice.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(invoice.originalName)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
