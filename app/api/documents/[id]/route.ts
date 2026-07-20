import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await readSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await context.params;

  const rows = await query<{
    storage_key: string;
    original_name: string;
    mime_type: string;
  }>(
    `
    SELECT storage_key, original_name, mime_type
    FROM documents
    WHERE id=$1 AND company_id=$2
    LIMIT 1
    `,
    [id, session.companyId],
  );

  const document = rows[0];
  if (!document) {
    return new NextResponse("Document introuvable.", { status: 404 });
  }

  const absolutePath = path.join(
    process.cwd(),
    "storage",
    "uploads",
    document.storage_key,
  );

  try {
    const file = await readFile(absolutePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": document.mime_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.original_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Fichier absent du stockage.", { status: 404 });
  }
}
