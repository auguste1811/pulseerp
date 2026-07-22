import Link from "next/link";
import { signOut } from "@/auth";
import { requirePlatformAdmin } from "@/lib/platform-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="platform-admin-shell">
      <aside className="platform-admin-sidebar">
        <Link className="platform-admin-brand" href="/admin">
          <span>P</span>
          <div>
            <strong>PulseERP</strong>
            <small>Super Admin</small>
          </div>
        </Link>

        <nav>
          <Link href="/admin">Entreprises</Link>
          <Link href="/admin/new">Créer une entreprise</Link>
          <Link href="/dashboard">Espace client</Link>
        </nav>

        <div className="platform-admin-user">
          <strong>
            {admin.firstName} {admin.lastName}
          </strong>
          <small>{admin.email}</small>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/developer/login" });
            }}
          >
            <button type="submit">Se déconnecter</button>
          </form>
        </div>
      </aside>

      <main className="platform-admin-content">{children}</main>
    </div>
  );
}
