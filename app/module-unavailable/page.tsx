import Link from "next/link";

export default async function ModuleUnavailable({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="access-state-page">
      <section className="access-state-card">
        <span className="access-state-icon">🔒</span>
        <p className="eyebrow">Module non activé</p>
        <h1>Cet outil n’est pas disponible pour votre entreprise</h1>
        <p>
          Le module <strong>{params.module || "demandé"}</strong> n’est pas
          compris dans votre accès actuel. Contactez l’administrateur de
          PulseERP pour l’activer.
        </p>
        <Link href="/dashboard" className="primary-action">
          Retour au tableau de bord
        </Link>
      </section>
    </main>
  );
}
