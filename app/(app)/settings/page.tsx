import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManageCompanySettings } from "@/lib/permissions";
import {
  changePassword,
  updateCompanySettings,
  updateProfile,
} from "./actions";
import styles from "./settings.module.css";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const member = await currentContext();
  const feedback = await searchParams;

  const [companies, users] = await Promise.all([
    query<any>("SELECT * FROM companies WHERE id=$1 LIMIT 1", [
      member.company_id,
    ]),
    query<any>(
      `
      SELECT first_name, last_name, email
      FROM users
      WHERE id=$1
      LIMIT 1
      `,
      [member.user_id],
    ),
  ]);

  const company = companies[0];
  const user = users[0];
  const canManage = canManageCompanySettings(member.role);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>Paramètres</h1>
        <p>Configurez votre entreprise, votre facturation et votre compte.</p>
      </header>

      {(feedback.saved ||
        feedback.profileSaved ||
        feedback.passwordSaved) && (
        <div className="import-alert success">
          <strong>Paramètres enregistrés.</strong>
          <span>Les modifications ont été appliquées.</span>
        </div>
      )}

      {(feedback.error ||
        feedback.profileError ||
        feedback.passwordError) && (
        <div className="import-alert error">
          <strong>Enregistrement impossible.</strong>
          <span>
            {feedback.profileError === "email"
              ? "Cette adresse email est déjà utilisée."
              : feedback.passwordError === "current"
                ? "Le mot de passe actuel est incorrect."
                : "Vérifiez les informations saisies."}
          </span>
        </div>
      )}

      <div className={styles.layout}>
        <nav className={styles.navigation}>
          <a href="#company">Entreprise</a>
          <a href="#billing">Facturation</a>
          <a href="#profile">Mon compte</a>
        </nav>

        <main className={styles.content}>
          {canManage && (
            <section className={styles.card} id="company">
              <header className={styles.cardHeader}>
                <h2>Informations de l’entreprise</h2>
                <p>
                  Ces coordonnées seront utilisées dans PulseERP et sur les
                  documents commerciaux.
                </p>
              </header>

              <form action={updateCompanySettings} className={styles.form}>
                <div className={styles.row}>
                  <label>
                    Nom commercial
                    <input
                      name="name"
                      defaultValue={company.name ?? ""}
                      required
                    />
                  </label>

                  <label>
                    Raison sociale
                    <input
                      name="legalName"
                      defaultValue={company.legal_name ?? ""}
                    />
                  </label>
                </div>

                <label>
                  Adresse
                  <input
                    name="address"
                    defaultValue={company.address ?? ""}
                  />
                </label>

                <div className={styles.row}>
                  <label>
                    Code postal
                    <input
                      name="postalCode"
                      defaultValue={company.postal_code ?? ""}
                    />
                  </label>

                  <label>
                    Ville
                    <input
                      name="city"
                      defaultValue={company.city ?? ""}
                    />
                  </label>
                </div>

                <div className={styles.row}>
                  <label>
                    Pays
                    <input
                      name="country"
                      defaultValue={company.country ?? "France"}
                      required
                    />
                  </label>

                  <label>
                    Email de l’entreprise
                    <input
                      name="email"
                      type="email"
                      defaultValue={company.email ?? ""}
                    />
                  </label>
                </div>

                <div className={styles.row}>
                  <label>
                    Téléphone
                    <input
                      name="phone"
                      defaultValue={company.phone ?? ""}
                    />
                  </label>

                  <label>
                    Site internet
                    <input
                      name="website"
                      defaultValue={company.website ?? ""}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className={styles.row}>
                  <label>
                    SIRET
                    <input
                      name="siret"
                      defaultValue={company.siret ?? ""}
                    />
                  </label>

                  <label>
                    Numéro de TVA
                    <input
                      name="vatNumber"
                      defaultValue={company.vat_number ?? ""}
                    />
                  </label>
                </div>

                <section id="billing">
                  <header className={styles.cardHeader}>
                    <h2>Paramètres de facturation</h2>
                    <p>
                      Définissez les valeurs par défaut appliquées aux devis et
                      factures.
                    </p>
                  </header>

                  <div className={styles.form}>
                    <div className={styles.row}>
                      <label>
                        Devise
                        <select
                          name="currency"
                          defaultValue={company.currency ?? "EUR"}
                        >
                          <option value="EUR">EUR — Euro</option>
                          <option value="USD">USD — Dollar</option>
                          <option value="GBP">GBP — Livre sterling</option>
                          <option value="CHF">CHF — Franc suisse</option>
                        </select>
                      </label>

                      <label>
                        Taux de TVA par défaut
                        <input
                          name="defaultVatRate"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          defaultValue={Number(
                            company.default_vat_rate ?? 20,
                          )}
                        />
                      </label>
                    </div>

                    <div className={styles.row}>
                      <label>
                        Délai de paiement
                        <input
                          name="paymentTermsDays"
                          type="number"
                          min="0"
                          max="365"
                          defaultValue={company.payment_terms_days ?? 30}
                        />
                      </label>

                      <label>
                        Validité des devis
                        <input
                          name="quoteValidityDays"
                          type="number"
                          min="1"
                          max="365"
                          defaultValue={company.quote_validity_days ?? 30}
                        />
                      </label>
                    </div>

                    <div className={styles.row}>
                      <label>
                        Préfixe des devis
                        <input
                          name="quotePrefix"
                          defaultValue={company.quote_prefix ?? "DEV"}
                        />
                      </label>

                      <label>
                        Préfixe des factures
                        <input
                          name="invoicePrefix"
                          defaultValue={company.invoice_prefix ?? "FAC"}
                        />
                      </label>
                    </div>

                    <div className={styles.row}>
                      <label>
                        IBAN
                        <input
                          name="iban"
                          defaultValue={company.iban ?? ""}
                        />
                      </label>

                      <label>
                        BIC
                        <input
                          name="bic"
                          defaultValue={company.bic ?? ""}
                        />
                      </label>
                    </div>

                    <div className={styles.bankNotice}>
                      Les coordonnées bancaires apparaîtront sur les factures
                      imprimées afin de faciliter les règlements.
                    </div>

                    <label>
                      Pied de page des documents
                      <textarea
                        name="invoiceFooter"
                        defaultValue={company.invoice_footer ?? ""}
                        placeholder="Mentions légales, pénalités de retard, conditions..."
                      />
                    </label>
                  </div>
                </section>

                <button className={styles.saveButton} type="submit">
                  Enregistrer l’entreprise
                </button>
              </form>
            </section>
          )}

          <section className={styles.card} id="profile">
            <header className={styles.cardHeader}>
              <h2>Mon profil</h2>
              <p>Modifiez vos informations personnelles de connexion.</p>
            </header>

            <form action={updateProfile} className={styles.form}>
              <div className={styles.row}>
                <label>
                  Prénom
                  <input
                    name="firstName"
                    defaultValue={user.first_name}
                    required
                  />
                </label>

                <label>
                  Nom
                  <input
                    name="lastName"
                    defaultValue={user.last_name}
                    required
                  />
                </label>
              </div>

              <label>
                Adresse email
                <input
                  name="email"
                  type="email"
                  defaultValue={user.email}
                  required
                />
              </label>

              <button className={styles.saveButton} type="submit">
                Enregistrer mon profil
              </button>
            </form>
          </section>

          <section className={styles.card}>
            <header className={styles.cardHeader}>
              <h2>Sécurité du compte</h2>
              <p>Modifiez votre mot de passe de connexion.</p>
            </header>

            <form action={changePassword} className={styles.form}>
              <label>
                Mot de passe actuel
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <div className={styles.row}>
                <label>
                  Nouveau mot de passe
                  <input
                    name="newPassword"
                    type="password"
                    minLength={10}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label>
                  Confirmation
                  <input
                    name="confirmation"
                    type="password"
                    minLength={10}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>

              <button className={styles.saveButton} type="submit">
                Modifier le mot de passe
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
