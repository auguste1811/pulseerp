import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  listPlatformModules,
  requirePlatformAdmin,
} from "@/lib/platform-access";
import {
  updateCompanyAccess,
  updateCompanyModules,
  deleteManagedCompany,
} from "../../actions";

export default async function ManageCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    modulesSaved?: string;
    accessSaved?: string;
    deleteError?: string;
  }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const feedback = await searchParams;

  const [company, modules] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
          orderBy: { role: "asc" },
        },
        enabledModules: true,
      },
    }),
    listPlatformModules(),
  ]);

  if (!company) notFound();

  const enabled = new Set(
    company.enabledModules
      .filter((row) => row.enabled)
      .map((row) => row.moduleId),
  );

  return (
    <>
      <section className="platform-admin-heading">
        <div>
          <Link className="back-link" href="/admin">
            ← Retour aux entreprises
          </Link>
          <p className="eyebrow">Gestion client</p>
          <h1>{company.name}</h1>
          <p>
            Contrôlez le statut, la durée d’accès et les outils visibles par
            cette entreprise.
          </p>
        </div>
      </section>

      {(feedback.created ||
        feedback.modulesSaved ||
        feedback.accessSaved) && (
        <div className="import-alert success">
          <strong>Modifications enregistrées.</strong>
          <span>Les nouveaux droits sont appliqués immédiatement.</span>
        </div>
      )}

      <section className="platform-company-grid">
        <article className="platform-admin-card">
          <div className="platform-admin-card-header">
            <h2>Accès entreprise</h2>
            <p>Suspendre ou limiter la durée d’accès.</p>
          </div>

          <form action={updateCompanyAccess} className="premium-form">
            <input type="hidden" name="companyId" value={company.id} />

            <label>
              Statut
              <select name="status" defaultValue={company.status}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspendue</option>
              </select>
            </label>

            <label>
              Date d’expiration
              <input
                name="accessExpiresAt"
                type="date"
                defaultValue={
                  company.accessExpiresAt
                    ? company.accessExpiresAt.toISOString().slice(0, 10)
                    : ""
                }
              />
            </label>

            <button className="primary-action" type="submit">
              Enregistrer l’accès
            </button>
          </form>
        </article>

        <article className="platform-admin-card">
          <div className="platform-admin-card-header">
            <h2>Utilisateurs</h2>
            <p>{company.members.length} compte(s) rattaché(s).</p>
          </div>

          <div className="admin-members-list">
            {company.members.map((member) => (
              <div key={`${member.companyId}-${member.userId}`}>
                <span>
                  {member.user.firstName.slice(0, 1)}
                  {member.user.lastName.slice(0, 1)}
                </span>
                <div>
                  <strong>
                    {member.user.firstName} {member.user.lastName}
                  </strong>
                  <small>{member.user.email}</small>
                </div>
                <em>{member.role}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="platform-admin-card modules-management-card">
          <div className="platform-admin-card-header">
            <h2>Modules autorisés</h2>
            <p>
              Le menu et les routes serveur sont mis à jour après validation.
            </p>
          </div>

          <form action={updateCompanyModules}>
            <input type="hidden" name="companyId" value={company.id} />

            <div className="admin-module-grid">
              {modules.map((module) => (
                <label className="admin-module-option" key={module.id}>
                  <input
                    type="checkbox"
                    name={`module_${module.code}`}
                    defaultChecked={enabled.has(module.id)}
                  />
                  <span>
                    <strong>{module.name}</strong>
                    <small>{module.description}</small>
                  </span>
                </label>
              ))}
            </div>

            <button className="primary-action" type="submit">
              Enregistrer les modules
            </button>
          </form>
        </article>

        <article className="platform-admin-card platform-delete-company-card">
          <div className="platform-admin-card-header">
            <h2>Supprimer l’entreprise</h2>
            <p>
              Cette action supprime définitivement l’entreprise et toutes les
              données qui lui sont rattachées.
            </p>
          </div>

          {feedback.deleteError && (
            <div className="import-alert error">
              <strong>Suppression impossible.</strong>
              <span>
                {feedback.deleteError === "protected"
                  ? "Cette entreprise est protégée car votre compte développeur y appartient."
                  : 'Tapez exactement « DELETE » pour confirmer.'}
              </span>
            </div>
          )}

          <form action={deleteManagedCompany} className="premium-form">
            <input type="hidden" name="companyId" value={company.id} />

            <label>
              Confirmation
              <input
                name="confirmation"
                placeholder='Tapez DELETE'
                autoComplete="off"
                required
              />
            </label>

            <button className="danger-action" type="submit">
              Supprimer définitivement l’entreprise
            </button>
          </form>
        </article>

      </section>
    </>
  );
}
