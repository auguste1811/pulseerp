import Link from "next/link";
import { loginAction } from "./actions";

const errors: Record<string, string> = {
  invalid: "Vérifie le format de l'adresse email et du mot de passe.",
  credentials: "Email ou mot de passe incorrect.",
  google: "La connexion Google a échoué. Réessaie dans quelques instants.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="brand">
          <span className="brand-logo">P</span>
          <span style={{ color: "#111827" }}>PulseERP</span>
        </div>

        <h1>Connexion</h1>
        <p className="muted">Accédez à votre espace entreprise.</p>

        {params.created && (
          <p className="success-alert">
            Votre compte a été créé. Vous pouvez maintenant vous connecter.
          </p>
        )}

        {params.error && (
          <p className="alert">{errors[params.error] ?? errors.credentials}</p>
        )}

        <form action={loginAction} className="form">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.fr"
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="8 caractères minimum"
              required
            />
          </label>

          <button className="btn primary" type="submit">
            Se connecter
          </button>
        </form>

        <div className="auth-separator"><span>ou</span></div>

        <a className="btn google-btn" href="/api/auth/google">
          Continuer avec Google
        </a>

        <p className="auth-footer">
          Pas encore de compte ? <Link href="/register">Créer une entreprise</Link>
        </p>

        <details className="demo-box">
          <summary>Compte de démonstration</summary>
          <p>Email : demo@pulseerp.fr</p>
          <p>Mot de passe : Pulse123!</p>
        </details>
      </section>
    </main>
  );
}
