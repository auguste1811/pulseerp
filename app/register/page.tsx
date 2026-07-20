import Link from "next/link";
import { registerAction } from "./actions";

const errors: Record<string, string> = {
  invalid:
    "Vérifie les informations saisies. Le mot de passe doit contenir au moins 10 caractères.",
  exists: "Un compte existe déjà avec cette adresse email.",
};

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-wrap">
      <section className="login-card register-card">
        <div className="brand">
          <span className="brand-logo">P</span>
          <span style={{ color: "#111827" }}>PulseERP</span>
        </div>

        <h1>Créer votre espace</h1>
        <p className="muted">
          Créez votre compte dirigeant et votre première entreprise.
        </p>

        {params.error && (
          <p className="alert">{errors[params.error] ?? errors.invalid}</p>
        )}

        <form action={registerAction} className="form">
          <div className="form-row">
            <label>
              Prénom
              <input name="firstName" autoComplete="given-name" required />
            </label>
            <label>
              Nom
              <input name="lastName" autoComplete="family-name" required />
            </label>
          </div>

          <label>
            Entreprise
            <input name="companyName" autoComplete="organization" required />
          </label>

          <label>
            Email professionnel
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <div className="form-row">
            <label>
              Mot de passe
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            <label>
              Confirmation
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
          </div>

          <button className="btn primary" type="submit">
            Créer mon entreprise
          </button>
        </form>

        <p className="auth-footer">
          Déjà inscrit ? <Link href="/login">Se connecter</Link>
        </p>
      </section>
    </main>
  );
}
