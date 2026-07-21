"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { saveApiKeyConnection } from "@/lib/integrations";

export async function connectBridge(formData: FormData) {
  const member = await currentContext();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();

  if (!clientId || !clientSecret) {
    redirect("/integrations?error=bridge_config");
  }

  await saveApiKeyConnection({
    companyId: member.company_id,
    userId: member.user_id,
    provider: "BRIDGE",
    accountName: "Bridge Banking",
    apiKey: clientSecret,
    settings: { clientId },
  });

  revalidatePath("/integrations");
  redirect("/integrations?connected=bridge");
}

export async function disconnectIntegration(formData: FormData) {
  const member = await currentContext();
  const provider = String(formData.get("provider") ?? "");

  await query(
    `
    DELETE FROM integration_connections
    WHERE company_id=$1 AND provider=$2
    `,
    [member.company_id, provider],
  );

  revalidatePath("/integrations");
  redirect("/integrations?disconnected=1");
}
