import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth";

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE" | "VIEWER";

const hierarchy: Record<Role, number> = {
  VIEWER: 1,
  EMPLOYEE: 2,
  MANAGER: 3,
  ADMIN: 4,
  OWNER: 5,
};

export async function requireRole(minimumRole: Role) {
  const member = await currentContext();
  const current = hierarchy[(member.role as Role) ?? "VIEWER"] ?? 0;

  if (current < hierarchy[minimumRole]) {
    redirect("/dashboard?error=forbidden");
  }

  return member;
}

export function canManageMembers(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}


export function canManageCompanySettings(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}
