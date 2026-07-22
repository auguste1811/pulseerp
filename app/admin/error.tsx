"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PulseERP admin error", error);
  }, [error]);

  return (
    <section className="runtime-error-card admin-runtime-error">
      <span className="runtime-error-code">500</span>
      <p className="eyebrow">Administration</p>
      <h1>L’action n’a pas pu être terminée</h1>
      <p>
        Aucun nouvel essai ne doit être lancé avant d’avoir vérifié les
        informations. Vous pouvez réessayer sans perdre les autres données.
      </p>
      <button className="primary-action" type="button" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}
