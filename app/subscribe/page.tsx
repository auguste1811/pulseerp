import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth";

const plans = [
  {
    code: "STARTER",
    name: "Starter",
    popular: false,
    price: "19 €",
    description: "Pour les indépendants et petites structures.",
    features: [
      "1 utilisateur",
      "CRM et contacts",
      "Devis et factures",
      "Comptabilité",
      "Paiements Stripe",
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    price: "39 €",
    description: "Pour les équipes qui veulent centraliser leur gestion.",
    popular: true,
    features: [
      "Jusqu’à 5 utilisateurs",
      "Tout Starter",
      "Documents",
      "Agenda",
      "Automatisations",
      "App Center",
    ],
  },
  {
    code: "BUSINESS",
    name: "Business",
    popular: false,
    price: "79 €",
    description: "Pour les entreprises avec des besoins avancés.",
    features: [
      "Utilisateurs illimités",
      "Tout Pro",
      "Multi-entreprises",
      "Rôles avancés",
      "Support prioritaire",
      "Fonctionnalités premium futures",
    ],
  },
] as const;

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    reason?: string;
    error?: string;
  }>;
}) {
  const member = await currentContext({ allowExpired: true });
  const params = await searchParams;
  const subscription = member.subscription;

  if (params.success) {
    // Le webhook peut arriver quelques instants après le retour Checkout.
    // On garde donc cette page accessible avec un message de confirmation.
  }

  return (
    <main className="subscription-page">
      <header className="subscription-header">
        <Link href="/" className="subscription-brand">
          <span>P</span>
          PulseERP
        </Link>

        {subscription.hasAccess && (
          <Link className="secondary-action" href="/dashboard">
            Retour au tableau de bord
          </Link>
        )}
      </header>

      <section className="subscription-hero">
        <p className="eyebrow">Abonnement PulseERP</p>
        <h1>
          {subscription.isExpired
            ? "Votre essai gratuit est terminé"
            : "Choisissez l’offre adaptée à votre entreprise"}
        </h1>
        <p>
          {subscription.isExpired
            ? "Vos données sont conservées. Activez une offre pour retrouver immédiatement votre espace."
            : `Votre essai de 3 jours est actif. Il vous reste ${subscription.daysRemaining} jour${subscription.daysRemaining > 1 ? "s" : ""}.`}
        </p>
      </section>

      {params.success && (
        <div className="subscription-message success">
          <strong>Paiement confirmé.</strong>
          <span>
            Votre abonnement est en cours d’activation. Rechargez la page dans
            quelques secondes si le bouton d’accès n’apparaît pas encore.
          </span>
        </div>
      )}

      {params.canceled && (
        <div className="subscription-message warning">
          <strong>Paiement annulé.</strong>
          <span>Aucun prélèvement n’a été effectué.</span>
        </div>
      )}

      {params.error && (
        <div className="subscription-message error">
          <strong>Gestion impossible.</strong>
          <span>Vérifiez la configuration Stripe Billing.</span>
        </div>
      )}

      <section className="subscription-grid">
        {plans.map((plan) => (
          <article
            className={`subscription-card ${
              plan.popular ? "popular" : ""
            }`}
            key={plan.code}
          >
            {plan.popular && (
              <span className="subscription-popular">Recommandé</span>
            )}
            <h2>{plan.name}</h2>
            <p>{plan.description}</p>
            <div className="subscription-price">
              <strong>{plan.price}</strong>
              <span>/ mois HT</span>
            </div>

            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>

            <form
              action="/api/billing/subscription/checkout"
              method="post"
            >
              <input type="hidden" name="plan" value={plan.code} />
              <button className="subscription-button" type="submit">
                Choisir {plan.name}
              </button>
            </form>
          </article>
        ))}
      </section>

      {member.subscription.stripeCustomerId && (
        <section className="subscription-manage">
          <div>
            <strong>Déjà abonné ?</strong>
            <p>
              Modifiez votre carte, téléchargez vos factures ou résiliez depuis
              le portail sécurisé Stripe.
            </p>
          </div>
          <form action="/api/billing/subscription/portal" method="post">
            <button className="secondary-action" type="submit">
              Gérer mon abonnement
            </button>
          </form>
        </section>
      )}

      <p className="subscription-footnote">
        Paiement sécurisé par Stripe. Votre accès est activé automatiquement
        après confirmation du paiement.
      </p>
    </main>
  );
}
