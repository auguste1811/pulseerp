import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  connectBridge,
  disconnectIntegration,
} from "./actions";
import { SyncButton } from "./sync-button";
import styles from "./integrations.module.css";

const apps = [
  ["GOOGLE", "Google Calendar", "Synchronisez les rendez-vous et événements.", "google", "Calendrier"],
  ["MICROSOFT", "Microsoft 365", "Outlook Calendar, Microsoft Graph et email.", "microsoft", "Productivité"],
  ["STRIPE", "Stripe", "Encaissez les factures et suivez les paiements.", "stripe", "Paiement"],
  ["BRIDGE", "Bridge Banking", "Connectez les comptes bancaires via DSP2.", "bridge", "Banque"],
  ["GOOGLE_DRIVE", "Google Drive", "Archivez automatiquement vos documents.", "drive", "Stockage"],
  ["SLACK", "Slack", "Envoyez les alertes PulseERP dans vos canaux.", "slack", "Communication"],
] as const;

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const member = await currentContext();
  const feedback = await searchParams;
  const connections = await query<any>(
    `
    SELECT provider, account_email, account_name, status,
           last_sync_at, last_sync_status, last_error, settings
    FROM integration_connections
    WHERE company_id=$1
    `,
    [member.company_id],
  );

  const byProvider = new Map(
    connections.map((connection) => [connection.provider, connection]),
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>App Center</h1>
          <p>Connectez vos applications et centralisez vos outils dans PulseERP.</p>
        </div>
        <input className={styles.search} placeholder="Rechercher une application..." />
      </header>

      {(feedback.connected || feedback.disconnected) && (
        <div className="import-alert success">
          <strong>Intégration mise à jour.</strong>
          <span>La configuration a été enregistrée.</span>
        </div>
      )}

      {feedback.error && (
        <div className="import-alert error">
          <strong>Connexion impossible.</strong>
          <span>Vérifiez les identifiants développeur et la configuration OAuth.</span>
        </div>
      )}

      <nav className={styles.tabs}>
        <span>Toutes</span><span>Productivité</span><span>Paiement</span>
        <span>Banque</span><span>Stockage</span><span>Communication</span>
      </nav>

      <section className={styles.stats}>
        <article className={styles.stat}><span>Applications disponibles</span><strong>{apps.length}</strong></article>
        <article className={styles.stat}><span>Connectées</span><strong>{connections.length}</strong></article>
        <article className={styles.stat}><span>Dernières synchronisations réussies</span><strong>{connections.filter(c => c.last_sync_status === "SUCCESS").length}</strong></article>
        <article className={styles.stat}><span>À configurer</span><strong>{apps.length - connections.length}</strong></article>
      </section>

      <section className={styles.grid}>
        {apps.map(([provider, name, description, logoClass, category]) => {
          const connection = byProvider.get(provider);

          return (
            <article className={styles.card} key={provider}>
              <div className={styles.top}>
                <div className={styles.brand}>
                  <span className={`${styles.logo} ${styles[logoClass]}`}>
                    {name.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <small>{category}</small>
                  </div>
                </div>
                <span className={`${styles.badge} ${!connection ? styles.offline : ""}`}>
                  {connection ? "Connecté" : "Non connecté"}
                </span>
              </div>

              <p>{description}</p>

              {connection && (
                <div className={styles.meta}>
                  <div><span>Compte</span><strong>{connection.account_name || connection.account_email || "Configuré"}</strong></div>
                  <div><span>Dernière synchronisation</span><strong>{connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString("fr-FR") : "Jamais"}</strong></div>
                  <div><span>État</span><strong>{connection.last_sync_status || "Prêt"}</strong></div>
                </div>
              )}

              <div className={styles.actions}>
                {!connection && provider === "GOOGLE" && (
                  <a href="/api/integrations/google/start">Connecter Google</a>
                )}
                {!connection && provider === "MICROSOFT" && (
                  <a href="/api/integrations/microsoft/start">Connecter Microsoft</a>
                )}

                {!connection && provider === "STRIPE" && (
                  <form action="/api/integrations/stripe/connect" method="post">
                    <button type="submit">Connecter Stripe</button>
                  </form>
                )}

                {!connection && provider === "BRIDGE" && (
                  <form action={connectBridge} className={styles.form}>
                    <input name="clientId" placeholder="Bridge Client ID" required />
                    <input name="clientSecret" type="password" placeholder="Bridge Client Secret" required />
                    <button type="submit">Connecter Bridge</button>
                  </form>
                )}

                {!connection && ["GOOGLE_DRIVE", "SLACK"].includes(provider) && (
                  <button type="button" disabled>Connecteur prochain lot</button>
                )}

                {connection && provider === "GOOGLE" && <SyncButton provider="google" />}
                {connection && provider === "MICROSOFT" && <SyncButton provider="microsoft" />}
                {connection && provider === "STRIPE" && (
                  <form action="/api/integrations/stripe/sync" method="post">
                    <button type="submit">Actualiser</button>
                  </form>
                )}

                {connection && (
                  <form action={disconnectIntegration}>
                    <input type="hidden" name="provider" value={provider} />
                    <button type="submit">Déconnecter</button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div className={styles.notice}>
        Les connexions Google et Microsoft utilisent OAuth 2.0. Stripe utilise Connect Onboarding : le client autorise son propre compte sans saisir de clé API. Bridge enregistre les
        identifiants du projet ; l’ouverture du parcours bancaire utilisateur
        nécessite ensuite un compte Bridge actif.
      </div>
    </div>
  );
}
