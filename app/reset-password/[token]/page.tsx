import Link from "next/link";
import { resetPasswordAction } from "./actions";

export default async function ResetPassword({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const feedback = await searchParams;

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="brand">
          <span className="brand-logo">P</span>
          <span style={{ color: "#111827" }}>PulseERP</span>
        </div>

        <h1>Nouveau mot de passe</h1>
        <p className="muted">
          Choisissez un mot de passe d’au moins 10 caractères.
        </p>

        {feedback.error && (
          <p className="alert">
            Le lien ou les informations saisies sont invalides.
          </p>
        )}

        <form action={resetPasswordAction} className="form">
          <input type="hidden" name="token" value={token} />

          <label>
            Nouveau mot de passe
            <input
              name="password"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            Confirmation
            <input
              name="confirmation"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>

          <button className="btn primary" type="submit">
            Enregistrer le mot de passe
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  );
}
