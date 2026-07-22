import { prisma } from "@/lib/prisma";

export const ACQUISITION_SOURCES = [
  { code: "ADS", name: "Ads", aliases: ["ads", "google ads", "meta ads", "facebook ads", "paid"] },
  { code: "CLIPPING", name: "Clipping", aliases: ["clipping", "clip"] },
  { code: "UGC_AFFILIATE", name: "UGC / Affilié", aliases: ["ugc", "affilie", "affilié", "affiliate", "ugc / affilié"] },
  { code: "INFLUENCER", name: "Influenceur", aliases: ["influenceur", "influencer", "influence"] },
  { code: "ORGANIC", name: "Organique", aliases: ["organique", "organic", "seo", "direct"] },
  { code: "COMPARISON_SITE", name: "Site comparatif", aliases: ["site comparatif", "comparatif", "comparison"] },
] as const;

export type AcquisitionCode = (typeof ACQUISITION_SOURCES)[number]["code"];

export async function ensureAcquisitionChannels(companyId: string) {
  for (const source of ACQUISITION_SOURCES) {
    await prisma.acquisitionChannel.upsert({
      where: {
        companyId_code: {
          companyId,
          code: source.code,
        },
      },
      update: {
        name: source.name,
        isActive: true,
      },
      create: {
        companyId,
        code: source.code,
        name: source.name,
      },
    });
  }
}

export function monthStart(value?: string) {
  const now = new Date();
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}-01T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function monthInputValue(date: Date) {
  return date.toISOString().slice(0, 7);
}
