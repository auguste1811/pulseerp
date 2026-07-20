import Link from "next/link";
import { forgotPasswordAction } from "./actions";

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="brand">
          <span className="brand-logo">P</span>
          <span style={{ color: "#111827" }}>PulseERP</span>
        </div>

        <h1>Mot de passe oublié</h1>
        <p className="muted">
          Saisissez votre adresse email pour recevoir un lien sécurisé.
        </p>

        {params.sent ? (
          <p className="success-alert">
            Si un compte correspond à cette adresse, un email vient
            d’être envoyé.
          </p>
        ) : (
          <form action={forgotPasswordAction} className="form">
            <label>
              Adresse email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <button className="btn primary" type="submit">
              Envoyer le lien
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  );
}
