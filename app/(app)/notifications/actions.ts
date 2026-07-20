"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";

export async function markAllNotificationsRead() {
  const member = await currentContext();

  await query(
    `
    UPDATE notifications
    SET is_read=TRUE
    WHERE company_id=$1 AND user_id=$2
    `,
    [member.company_id, member.user_id],
  );

  revalidatePath("/notifications");
  redirect("/notifications?saved=1");
}
