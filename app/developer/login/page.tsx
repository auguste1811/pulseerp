import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPlatformAdminIdentity } from "@/lib/platform-access";
import { developerLogin } from "./actions";

export default async function DeveloperLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        isActive: true,
        isPlatformAdmin: true,
      },
    });

    if (user?.isActive && isPlatformAdminIdentity(user)) {
      redirect("/admin");
    }
  }

  return (
    <main className="developer-login-page">
      <section className="developer-login-card">
        <div className="developer-login-brand">
          <span>P</span>
          <div>
            <strong>PulseERP</strong>
            <small>Portail développeur</small>
          </div>
        </div>

        <div className="developer-login-heading">
          <p className="eyebrow">Administration plateforme</p>
          <h1>Connexion développeur</h1>
          <p>
            Cet espace est réservé aux administrateurs globaux de PulseERP.
          </p>
        </div>

        {params.error && (
          <div className="import-alert error">
            <strong>Connexion impossible.</strong>
            <span>
              {params.error === "credentials"
                ? "Email ou mot de passe incorrect."
                : "Renseignez les deux champs."}
            </span>
          </div>
        )}

        <form action={developerLogin} className="developer-login-form">
          <label>
            Adresse email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="primary-action full-width" type="submit">
            Accéder au back-office
          </button>
        </form>

        <p className="developer-login-help">
          Le compte développeur est distinct des entreprises clientes. Créez-le
          avec la commande indiquée dans le guide d’installation.
        </p>
      </section>
    </main>
  );
}
