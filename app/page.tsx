import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

function PulseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h3.2l1.9-5.2 3.4 10.4 2.4-7.1 1.7 3.9H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Icon({
  name,
  size = 22,
}: {
  name: "crm" | "billing" | "tasks" | "calendar" | "reports" | "automation" | "check";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  };

  if (name === "crm") return <svg {...common}><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3.5 19c.4-3.5 2.2-5.3 5.5-5.3s5.1 1.8 5.5 5.3M16 9.5a2.5 2.5 0 1 0 0-5M16.3 13.8c2.7.2 4 1.7 4.2 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === "billing") return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M8 8h8M8 12h3M8 16h8M15.5 11.5v4M13.5 13.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === "tasks") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="m8 12 2.2 2.2L16 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === "reports") return <svg {...common}><path d="M4 19V9M10 19V4M16 19v-7M22 19H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === "automation") return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/></svg>;
  return <svg {...common}><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

const features = [
  {
    icon: "crm" as const,
    title: "CRM centralisé",
    text: "Suivez vos prospects, vos clients et l’ensemble de leurs interactions depuis une seule interface.",
  },
  {
    icon: "billing" as const,
    title: "Devis & factures",
    text: "Créez vos documents commerciaux, suivez les paiements et centralisez votre activité financière.",
  },
  {
    icon: "tasks" as const,
    title: "Travail d’équipe",
    text: "Attribuez les tâches, organisez les priorités et donnez à chacun une vision claire de son travail.",
  },
  {
    icon: "calendar" as const,
    title: "Calendrier & relances",
    text: "Planifiez les rendez-vous, les échéances et les relances directement liées à vos contacts.",
  },
  {
    icon: "reports" as const,
    title: "Rapports de pilotage",
    text: "Analysez le chiffre d’affaires, les dépenses et les performances commerciales en temps réel.",
  },
  {
    icon: "automation" as const,
    title: "Automatisations",
    text: "Créez des workflows capables de générer des tâches, des alertes et des actions sans intervention manuelle.",
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo}><PulseIcon /></span>
          <strong>PulseERP</strong>
        </Link>

        <div className={styles.navLinks}>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#automatisation">Automatisation</a>
          <a href="#apercu">Aperçu</a>
          <Link href="/login" className={styles.loginButton}>
            Connexion
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.badge}>
            <i />
            La gestion d’entreprise, enfin réunie
          </div>

          <h1>
            Pilotez votre entreprise avec une seule <span>plateforme</span>
          </h1>

          <p className={styles.heroText}>
            PulseERP rassemble CRM, facturation, tâches, documents,
            calendrier, rapports et automatisations dans un outil clair,
            moderne et conçu pour les équipes qui veulent gagner du temps.
          </p>

          <div className={styles.heroActions}>
            <Link href="/login" className={styles.primary}>
              Découvrir l’espace PulseERP
              <span>→</span>
            </Link>
            <a href="#fonctionnalites" className={styles.secondary}>
              Voir les fonctionnalités
            </a>
          </div>

          <div className={styles.heroFacts}>
            <span><b>✓</b> Données séparées par entreprise</span>
            <span><b>✓</b> Interface web responsive</span>
            <span><b>✓</b> Workflows automatisés</span>
          </div>
        </div>

        <div className={styles.previewShell}>
          <div className={styles.previewGlow} />
          <div className={styles.preview}>
            <Image
              src="/pulseerp-dashboard-preview.png"
              alt="Aperçu de l’interface PulseERP"
              width={1536}
              height={1024}
              priority
            />
          </div>

          <div className={styles.floatingCard}>
            <span className={styles.floatingIcon}><Icon name="check" /></span>
            <div>
              <strong>Activité centralisée</strong>
              <small>CRM, équipe et pilotage réunis</small>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.trusted}>
        Pensé pour les <strong>TPE, PME, indépendants et équipes commerciales</strong>
      </div>

      <section className={styles.section} id="fonctionnalites">
        <header className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Une plateforme complète</span>
          <h2>Les outils essentiels pour gérer et développer votre activité</h2>
          <p>
            PulseERP évite la multiplication des logiciels et vous permet de
            retrouver vos informations au même endroit.
          </p>
        </header>

        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article className={styles.feature} key={feature.title}>
              <span className={styles.featureIcon}>
                <Icon name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="automatisation">
        <div className={styles.automation}>
          <div className={styles.automationCopy}>
            <span className={styles.eyebrow}>Pulse Automation</span>
            <h2>Un outil qui agit, pas seulement un outil qui affiche</h2>
            <p>
              Déclenchez automatiquement des tâches et des notifications à
              partir des événements de votre CRM, de vos factures ou de vos
              documents.
            </p>
          </div>

          <div className={styles.workflow}>
            <div className={styles.workflowCard}>
              <span><Icon name="billing" /></span>
              <div>
                <strong>Déclencheur</strong>
                <small>Une facture supérieure à 2 000 € est créée</small>
              </div>
              <em>Détecté</em>
            </div>
            <div className={styles.arrow}>↓</div>
            <div className={styles.workflowCard}>
              <span><Icon name="tasks" /></span>
              <div>
                <strong>Action automatique</strong>
                <small>Créer une tâche de suivi prioritaire</small>
              </div>
              <em>Exécuté</em>
            </div>
            <div className={styles.arrow}>↓</div>
            <div className={styles.workflowCard}>
              <span><Icon name="automation" /></span>
              <div>
                <strong>Notification</strong>
                <small>Avertir le responsable de l’entreprise</small>
              </div>
              <em>Envoyée</em>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="apercu">
        <div className={styles.productShowcase}>
          <div className={styles.productImage}>
            <Image
              src="/pulseerp-team-preview.png"
              alt="Gestion de l’équipe dans PulseERP"
              width={1536}
              height={1024}
            />
          </div>

          <div className={styles.productCopy}>
            <span className={styles.eyebrow}>Conçu pour travailler ensemble</span>
            <h2>Une vision claire des rôles, des tâches et de l’activité</h2>
            <p>
              Chaque collaborateur dispose d’un accès adapté à son rôle.
              L’entreprise garde le contrôle sur les droits, les tâches et les
              informations essentielles.
            </p>

            <div className={styles.checkList}>
              <div><b>✓</b> Comptes et rôles utilisateurs</div>
              <div><b>✓</b> Attribution et suivi des tâches</div>
              <div><b>✓</b> Historique et notifications internes</div>
              <div><b>✓</b> Isolation des données par entreprise</div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <h2>Découvrez dès maintenant l’environnement PulseERP</h2>
        <p>
          Connectez-vous pour parcourir le tableau de bord, le CRM, les
          rapports et le centre d’automatisation.
        </p>
        <Link href="/login" className={styles.ctaButton}>
          Accéder à la connexion
        </Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.logo}><PulseIcon size={19} /></span>
          PulseERP
        </div>
        <span>© 2026 PulseERP — Solution de gestion d’entreprise.</span>
      </footer>
    </main>
  );
}
