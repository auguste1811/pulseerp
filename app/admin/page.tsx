import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-access";
import { CompanySelectionTable } from "./company-selection-table";

export default async function PlatformAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string;
    company?: string;
    bulkDeleted?: string;
    skipped?: string;
    deleteError?: string;
  }>;
}) {
  const admin = await requirePlatformAdmin();
  const feedback = await searchParams;

  const [companies, companyCount, activeCount, userCount, adminMemberships] =
    await Promise.all([
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
      prisma.companyMember.findMany({
        where: { userId: admin.id },
        select: { companyId: true },
      }),
    ]);

  const protectedIds = new Set(
    adminMemberships.map((membership) => membership.companyId),
  );

  const rows = companies.map((company) => {
    const owner = company.members[0]?.user;
    const expired =
      Boolean(company.accessExpiresAt) &&
      company.accessExpiresAt!.getTime() <= Date.now();

    return {
      id: company.id,
      name: company.name,
      email: company.email,
      ownerName: owner
        ? `${owner.firstName} ${owner.lastName}`
        : "Non défini",
      ownerEmail: owner?.email || "",
      memberCount: company._count.members,
      moduleCount: company.enabledModules.length,
      accessExpiresAt: company.accessExpiresAt?.toISOString() || null,
      status: company.status,
      expired,
      protected: protectedIds.has(company.id),
    };
  });

  const errorMessage =
    feedback.deleteError === "selection"
      ? "Sélectionnez au moins une entreprise."
      : feedback.deleteError === "confirmation"
        ? 'Tapez exactement « DELETE » pour confirmer.'
        : feedback.deleteError === "protected"
          ? "L’entreprise sélectionnée est protégée et ne peut pas être supprimée."
          : feedback.deleteError
            ? "La suppression n’a pas pu être effectuée."
            : null;

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

      {feedback.deleted && (
        <div className="import-alert success">
          <strong>Entreprise supprimée.</strong>
          <span>
            {feedback.company
              ? `${feedback.company} et ses données liées ont été supprimées.`
              : "L’entreprise et ses données liées ont été supprimées."}
          </span>
        </div>
      )}

      {feedback.bulkDeleted && (
        <div className="import-alert success">
          <strong>{feedback.bulkDeleted} entreprise(s) supprimée(s).</strong>
          <span>
            {Number(feedback.skipped || 0) > 0
              ? `${feedback.skipped} élément(s) protégé(s) ou introuvable(s) ont été ignorés.`
              : "Toutes les entreprises sélectionnées ont été supprimées."}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="import-alert error">
          <strong>Suppression impossible.</strong>
          <span>{errorMessage}</span>
        </div>
      )}

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

        <CompanySelectionTable companies={rows} />
      </section>
    </>
  );
}
