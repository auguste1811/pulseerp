import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const [companies, users, modules] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.appModule.count(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        database: "reachable",
        counts: { companies, users, modules },
        responseTimeMs: Date.now() - startedAt,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
        version: "3.9.0",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Runtime health check failed", error);

    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        responseTimeMs: Date.now() - startedAt,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
        version: "3.9.0",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
