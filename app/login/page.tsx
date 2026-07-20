import Link from "next/link";
import {
  loginAction,
  signInGitHub,
  signInGoogle,
  signInMicrosoft,
} from "./actions";
import styles from "./login.module.css";

const errors: Record<string, string> = {
  credentials: "Email ou mot de passe incorrect.",
  OAuthAccountNotLinked:
    "Cette adresse existe déjà avec une autre méthode de connexion.",
  Configuration:
    "Ce fournisseur n’est pas encore configuré sur le serveur.",
  AccessDenied: "L’accès à ce compte a été refusé.",
  default: "La connexion a échoué. Réessaie dans quelques instants.",
};

function MailIcon() {
  return <span aria-hidden="true">✉</span>;
}

function LockIcon() {
  return <span aria-hidden="true">●</span>;
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    created?: string;
    reset?: string;
  }>;
}) {
  const params = await searchParams;

  const googleEnabled = Boolean(
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
      (process.env.AUTH_GOOGLE_SECRET ||
        process.env.GOOGLE_CLIENT_SECRET),
  );

  const microsoftEnabled = Boolean(
    (process.env.AUTH_MICROSOFT_ENTRA_ID_ID ||
      process.env.MICROSOFT_CLIENT_ID) &&
      (process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ||
        process.env.MICROSOFT_CLIENT_SECRET),
  );

  const githubEnabled = Boolean(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
  );

  const oauthCount = [
    googleEnabled,
    microsoftEnabled,
    githubEnabled,
  ].filter(Boolean).length;

  return (
    <main className={styles.page}>
      <section className={styles.showcase}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo}>P</span>
          <strong>PulseERP</strong>
        </Link>

        <div className={styles.showcaseContent}>
          <span className={styles.badge}>
            <i className={styles.badgeDot} />
            Votre entreprise, parfaitement orchestrée
          </span>

          <h1>Une seule plateforme pour piloter toute votre activité.</h1>

          <p className={styles.showcaseLead}>
            Centralisez votre CRM, vos factures, vos tâches, vos documents,
            vos rapports et vos automatisations dans un environnement
            sécurisé.
          </p>

          <div className={styles.featureList}>
            <div className={styles.feature}>
              <span className={styles.check}>✓</span>
              <div>
                <strong>Multi-entreprises</strong>
                <span>Des données isolées et des rôles adaptés à chaque équipe.</span>
              </div>
            </div>

            <div className={styles.feature}>
              <span className={styles.check}>✓</span>
              <div>
                <strong>Connexion sécurisée</strong>
                <span>Email, Google, Microsoft ou GitHub selon vos besoins.</span>
              </div>
            </div>

            <div className={styles.feature}>
              <span className={styles.check}>✓</span>
              <div>
                <strong>Pilotage en temps réel</strong>
                <span>Indicateurs, calendrier et activité réunis au même endroit.</span>
              </div>
            </div>

            <div className={styles.feature}>
              <span className={styles.check}>✓</span>
              <div>
                <strong>Automatisations</strong>
                <span>Réduisez les tâches répétitives et les oublis opérationnels.</span>
              </div>
            </div>
          </div>
        </div>

        <span className={styles.showcaseFooter}>
          © 2026 PulseERP — Plateforme de gestion d’entreprise.
        </span>
      </section>

      <section className={styles.formSide}>
        <div className={styles.card}>
          <Link href="/" className={styles.mobileBrand}>
            <span className={styles.logo}>P</span>
            <strong>PulseERP</strong>
          </Link>

          <h2>Bienvenue</h2>
          <p className={styles.subtitle}>
            Connectez-vous pour retrouver votre espace de travail.
          </p>

          {(params.created || params.reset) && (
            <div className={styles.success}>
              {params.reset
                ? "Votre mot de passe a été modifié avec succès."
                : "Votre entreprise a été créée. Vous pouvez vous connecter."}
            </div>
          )}

          {params.error && (
            <div className={styles.alert}>
              {errors[params.error] || errors.default}
            </div>
          )}

          {oauthCount > 0 && (
            <>
              <div
                className={`${styles.oauthGrid} ${
                  oauthCount === 1 ? styles.oauthGridSingle : ""
                }`}
              >
                {googleEnabled && (
                  <form action={signInGoogle} className={styles.oauthForm}>
                    <button className={styles.oauthButton} type="submit">
                      <span aria-hidden="true">G</span>
                      Google
                    </button>
                  </form>
                )}

                {microsoftEnabled && (
                  <form action={signInMicrosoft} className={styles.oauthForm}>
                    <button className={styles.oauthButton} type="submit">
                      <span aria-hidden="true">M</span>
                      Microsoft
                    </button>
                  </form>
                )}

                {githubEnabled && (
                  <form action={signInGitHub} className={styles.oauthForm}>
                    <button className={styles.oauthButton} type="submit">
                      <span aria-hidden="true">GH</span>
                      GitHub
                    </button>
                  </form>
                )}
              </div>

              <div className={styles.separator}>ou avec votre email</div>
            </>
          )}

          <form action={loginAction} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email">Adresse email</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><MailIcon /></span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@entreprise.fr"
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <label htmlFor="password">Mot de passe</label>
                <Link href="/forgot-password" className={styles.forgot}>
                  Mot de passe oublié ?
                </Link>
              </div>

              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><LockIcon /></span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  required
                />
              </div>
            </div>

            <button className={styles.submit} type="submit">
              Se connecter
            </button>
          </form>

          <p className={styles.footerText}>
            Pas encore de compte ?{" "}
            <Link href="/register">Créer votre entreprise</Link>
          </p>

          <details className={styles.demo}>
            <summary>Utiliser le compte de démonstration</summary>
            <div className={styles.demoContent}>
              Email : <code>demo@pulseerp.fr</code>
              <br />
              Mot de passe : <code>Pulse123!</code>
            </div>
          </details>

          {oauthCount === 0 && (
            <p className={styles.configurationNote}>
              Les boutons Google, Microsoft et GitHub apparaîtront
              automatiquement après configuration des variables OAuth.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
