import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { PLANS, ensureCompanySubscription } from "@/lib/subscription";

const ERRORS: Record<string, string> = {
  plan: "Formule invalide. Choisissez Starter, Pro ou Business.",
  config: "Paiement non configuré. Contactez le support.",
  stripe: "Stripe est momentanément indisponible. Réessayez.",
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const member = await currentContext({ allowExpired: true });
  const access = await ensureCompanySubscription(member.company_id);
  const feedback = await searchParams;

  return (
    <main className="subscription-page">
      <header className="subscription-header">
        <Link href="/" className="subscription-brand">
          <span>P</span>
          PulseERP
        </Link>
        {access.hasAccess && (
          <Link className="secondary-action" href="/dashboard">
            Retour au tableau de bord
          </Link>
        )}
      </header>

      <section className="subscription-hero">
        <p className="eyebrow">Abonnement mensuel — sans engagement</p>
        {access.status === "ACTIVE" ? (
          <>
            <h1>Votre abonnement est actif</h1>
            <p>
              Espace {member.company_name} : formule {access.plan}. Gérez votre
              carte, vos factures et la résiliation depuis le portail sécurisé.
            </p>
          </>
        ) : access.isPastDue ? (
          <>
            <h1>Paiement à régulariser</h1>
            <p>
              Le dernier prélèvement pour {member.company_name} a échoué.
              Mettez à jour votre carte pour débloquer l’accès — vos données
              sont conservées.
            </p>
          </>
        ) : access.isTrial ? (
          <>
            <h1>
              {access.daysRemaining} jour{access.daysRemaining > 1 ? "s" : ""} d’essai
              restant{access.daysRemaining > 1 ? "s" : ""}
            </h1>
            <p>
              Espace {member.company_name} : profitez de tout PulseERP
              gratuitement, puis choisissez une formule mensuelle pour
              continuer sans interruption.
            </p>
          </>
        ) : (
          <>
            <h1>Votre essai est terminé</h1>
            <p>
              Pour continuer à utiliser {member.company_name}, choisissez une
              formule mensuelle. Accès débloqué dès le paiement.
            </p>
          </>
        )}
      </section>

      {feedback.error && ERRORS[feedback.error] && (
        <div className="import-alert error" style={{ maxWidth: 720, margin: "0 auto 18px" }}>
          <strong>Paiement impossible.</strong>
          <span>{ERRORS[feedback.error]}</span>
        </div>
      )}
      {feedback.canceled && (
        <div className="import-alert error" style={{ maxWidth: 720, margin: "0 auto 18px" }}>
          <strong>Paiement annulé.</strong>
          <span>Vous pouvez recommencer quand vous voulez.</span>
        </div>
      )}

      {(access.status === "ACTIVE" || access.isPastDue) && (
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <form action="/api/billing/subscription/portal" method="POST">
            <button className="subscription-button" type="submit">
              {access.isPastDue ? "Mettre à jour ma carte et retenter" : "Gérer mon abonnement"}
            </button>
          </form>
        </div>
      )}

      <section className="subscription-grid">
        {PLANS.map((plan, index) => (
          <article
            key={plan.code}
            className={`subscription-card${index === 1 ? " popular" : ""}`}
          >
            {index === 1 && <span className="subscription-popular">Le plus choisi</span>}
            <h2>{plan.name}</h2>
            <p>{plan.description}</p>
            <div className="subscription-price">
              <strong>{plan.priceHt} € HT</strong>
              <span>/ mois</span>
            </div>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <form action="/api/billing/subscription/checkout" method="POST">
              <input type="hidden" name="plan" value={plan.code} />
              <button className="subscription-button" type="submit">
                Choisir {plan.name}
              </button>
            </form>
          </article>
        ))}
      </section>

      <p className="subscription-footnote">
        Paiement sécurisé par Stripe. Facture mensuelle, résiliable à tout moment
        depuis le portail. En cas d’échec de prélèvement, l’accès est suspendu
        jusqu’à régularisation.
      </p>
    </main>
  );
}
