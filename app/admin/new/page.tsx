import Link from "next/link";
import { listPlatformModules, requirePlatformAdmin } from "@/lib/platform-access";
import { createManagedCompany } from "../actions";

export default async function CreateCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePlatformAdmin();
  const modules = await listPlatformModules();
  const feedback = await searchParams;

  return (
    <>
      <section className="platform-admin-heading">
        <div>
          <Link className="back-link" href="/admin">
            ← Retour aux entreprises
          </Link>
          <p className="eyebrow">Provisionnement</p>
          <h1>Créer une entreprise cliente</h1>
          <p>
            Créez le responsable principal et choisissez immédiatement les
            modules autorisés.
          </p>
        </div>
      </section>

      {feedback.error && (
        <div className="import-alert error">
          <strong>Création impossible.</strong>
          <span>
            {feedback.error === "email"
              ? "Cette adresse email possède déjà un compte."
              : feedback.error === "modules"
                ? "Activez au moins un module."
                : "Vérifiez les informations saisies."}
          </span>
        </div>
      )}

      <form action={createManagedCompany} className="platform-admin-form-grid">
        <section className="platform-admin-card">
          <div className="platform-admin-card-header">
            <h2>Entreprise</h2>
            <p>Informations générales et durée d’accès.</p>
          </div>

          <label>
            Nom de l’entreprise
            <input name="companyName" required />
          </label>

          <label>
            Date d’expiration
            <input name="accessExpiresAt" type="date" />
            <small>Laissez vide pour un accès illimité.</small>
          </label>
        </section>

        <section className="platform-admin-card">
          <div className="platform-admin-card-header">
            <h2>Responsable principal</h2>
            <p>Ce compte recevra le rôle Propriétaire.</p>
          </div>

          <div className="form-row">
            <label>
              Prénom
              <input name="ownerFirstName" required />
            </label>
            <label>
              Nom
              <input name="ownerLastName" required />
            </label>
          </div>

          <label>
            Adresse email
            <input name="ownerEmail" type="email" required />
          </label>

          <label>
            Mot de passe temporaire
            <input
              name="temporaryPassword"
              type="password"
              minLength={10}
              required
            />
          </label>
        </section>

        <section className="platform-admin-card modules-selection-card">
          <div className="platform-admin-card-header">
            <h2>Outils autorisés</h2>
            <p>
              Les pages non activées seront masquées et bloquées côté serveur.
            </p>
          </div>

          <div className="admin-module-grid">
            {modules.map((module) => (
              <label className="admin-module-option" key={module.id}>
                <input
                  type="checkbox"
                  name={`module_${module.code}`}
                  defaultChecked={[
                    "DASHBOARD",
                    "CRM",
                    "BILLING",
                    "TASKS",
                    "CALENDAR",
                  ].includes(module.code)}
                />
                <span>
                  <strong>{module.name}</strong>
                  <small>{module.description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <div className="platform-admin-submit">
          <button className="primary-action" type="submit">
            Créer l’entreprise et son accès
          </button>
        </div>
      </form>
    </>
  );
}
