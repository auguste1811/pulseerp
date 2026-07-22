"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PulseERP route error", error);
  }, [error]);

  return (
    <main className="runtime-error-page">
      <section className="runtime-error-card">
        <span className="runtime-error-code">500</span>
        <p className="eyebrow">Erreur temporaire</p>
        <h1>Cette page n’a pas pu être chargée</h1>
        <p>
          Vos données n’ont pas été supprimées. Réessayez l’opération ou
          retournez au tableau de bord.
        </p>
        {error.digest && <small>Référence : {error.digest}</small>}
        <div className="runtime-error-actions">
          <button className="primary-action" type="button" onClick={reset}>
            Réessayer
          </button>
          <a className="secondary-action" href="/dashboard">
            Tableau de bord
          </a>
        </div>
      </section>
    </main>
  );
}
