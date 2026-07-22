import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="runtime-error-page">
      <section className="runtime-error-card">
        <span className="runtime-error-code">404</span>
        <p className="eyebrow">Page introuvable</p>
        <h1>Cette page n’existe pas ou n’est plus disponible</h1>
        <p>
          Vérifiez l’adresse ou retournez vers un espace accessible de
          PulseERP.
        </p>
        <div className="runtime-error-actions">
          <Link className="primary-action" href="/dashboard">
            Tableau de bord
          </Link>
          <Link className="secondary-action" href="/login">
            Connexion
          </Link>
        </div>
      </section>
    </main>
  );
}
