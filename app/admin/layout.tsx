import Link from "next/link";
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
          <Link href="/dashboard">Retour à PulseERP</Link>
        </nav>

        <div className="platform-admin-user">
          <strong>
            {admin.firstName} {admin.lastName}
          </strong>
          <small>{admin.email}</small>
        </div>
      </aside>

      <main className="platform-admin-content">{children}</main>
    </div>
  );
}
