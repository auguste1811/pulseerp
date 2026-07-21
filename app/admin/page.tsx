import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-access";

export default async function PlatformAdminDashboard() {
  await requirePlatformAdmin();

  const [companies, companyCount, activeCount, userCount] = await Promise.all([
    prisma.company.findMany({
      include: {
        members: {
          where: { role: "OWNER" },
          include: { user: true },
          take: 1,
        },
        enabledModules: {
          where: { enabled: true },
          include: { module: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return (
    <>
      <section className="platform-admin-heading">
        <div>
          <p className="eyebrow">Administration plateforme</p>
          <h1>Entreprises clientes</h1>
          <p>
            Créez les espaces clients et contrôlez précisément les outils
            disponibles.
          </p>
        </div>
        <Link className="primary-action" href="/admin/new">
          + Nouvelle entreprise
        </Link>
      </section>

      <section className="platform-admin-kpis">
        <article>
          <span>Entreprises</span>
          <strong>{companyCount}</strong>
        </article>
        <article>
          <span>Actives</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <span>Utilisateurs actifs</span>
          <strong>{userCount}</strong>
        </article>
      </section>

      <section className="platform-admin-table-card">
        <div className="platform-admin-table-header">
          <h2>Liste des entreprises</h2>
          <span>{companies.length} résultat(s)</span>
        </div>

        <div className="platform-admin-table-wrap">
          <table className="platform-admin-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Responsable</th>
                <th>Utilisateurs</th>
                <th>Modules</th>
                <th>Expiration</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const owner = company.members[0]?.user;
                const expired =
                  company.accessExpiresAt &&
                  company.accessExpiresAt.getTime() <= Date.now();

                return (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.name}</strong>
                      <small>{company.email || "Aucun email société"}</small>
                    </td>
                    <td>
                      {owner
                        ? `${owner.firstName} ${owner.lastName}`
                        : "Non défini"}
                      <small>{owner?.email || ""}</small>
                    </td>
                    <td>{company._count.members}</td>
                    <td>
                      <span className="module-count-badge">
                        {company.enabledModules.length} actif(s)
                      </span>
                    </td>
                    <td>
                      {company.accessExpiresAt
                        ? company.accessExpiresAt.toLocaleDateString("fr-FR")
                        : "Illimité"}
                    </td>
                    <td>
                      <span
                        className={`company-status-badge ${
                          company.status === "ACTIVE" && !expired
                            ? "active"
                            : "suspended"
                        }`}
                      >
                        {expired
                          ? "Expirée"
                          : company.status === "ACTIVE"
                            ? "Active"
                            : "Suspendue"}
                      </span>
                    </td>
                    <td>
                      <Link href={`/admin/companies/${company.id}`}>
                        Gérer →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
