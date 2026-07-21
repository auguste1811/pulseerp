import Link from "next/link";
import { currentContext } from "@/lib/auth";

export default async function SubscribePage() {
  const member = await currentContext({ allowExpired: true });

  return (
    <main className="subscription-page">
      <header className="subscription-header">
        <Link href="/" className="subscription-brand">
          <span>P</span>
          PulseERP
        </Link>
        <Link className="secondary-action" href="/dashboard">
          Retour au tableau de bord
        </Link>
      </header>

      <section className="subscription-hero">
        <p className="eyebrow">PulseERP Preview</p>
        <h1>Les abonnements arrivent prochainement</h1>
        <p>
          Votre espace {member.company_name} reste entièrement accessible. Aucun
          paiement n’est demandé dans cette version de stabilisation.
        </p>
      </section>

      <section className="subscription-grid">
        <article className="subscription-card popular">
          <span className="subscription-popular">Accès actuel</span>
          <h2>Preview gratuite</h2>
          <p>Utilisez les fonctions principales de PulseERP sans limitation.</p>
          <div className="subscription-price">
            <strong>0 €</strong>
            <span>pendant la phase bêta</span>
          </div>
          <ul>
            <li>✓ CRM et pipeline</li>
            <li>✓ Devis et factures</li>
            <li>✓ Comptabilité</li>
            <li>✓ Tâches et calendrier</li>
            <li>✓ Documents et paramètres</li>
          </ul>
          <Link className="subscription-button" href="/dashboard">
            Continuer vers PulseERP
          </Link>
        </article>
      </section>

      <p className="subscription-footnote">
        Les paiements et abonnements seront réactivés après la phase de stabilisation.
      </p>
    </main>
  );
}
