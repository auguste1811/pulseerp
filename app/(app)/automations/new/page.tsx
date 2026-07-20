import Link from "next/link";
import { createAutomation } from "../actions";
import styles from "../automations.module.css";

export default function NewAutomationPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/automations">← Retour aux automatisations</Link>
          <h1>Nouvelle automatisation</h1>
          <p>Configurez un déclencheur, une condition et une action.</p>
        </div>
      </header>

      <section className={styles.card}>
        <form action={createAutomation} className={styles.form}>
          <label>
            Nom du workflow
            <input
              name="name"
              placeholder="Relance des grosses factures"
              required
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              placeholder="Expliquez ce que réalise cette automatisation."
            />
          </label>

          <p className={styles.sectionTitle}>1. Quand...</p>

          <label>
            Déclencheur
            <select name="triggerType" defaultValue="CONTACT_CREATED">
              <option value="CONTACT_CREATED">Nouveau contact</option>
              <option value="CONTACT_STATUS_CHANGED">
                Statut CRM modifié
              </option>
              <option value="INVOICE_CREATED">Facture créée</option>
              <option value="INVOICE_PAID">Facture payée</option>
              <option value="INVOICE_OVERDUE">
                Facture en retard
              </option>
              <option value="TASK_CREATED">Tâche créée</option>
              <option value="TASK_COMPLETED">Tâche terminée</option>
              <option value="DOCUMENT_UPLOADED">Document ajouté</option>
              <option value="MANUAL">Exécution manuelle</option>
            </select>
          </label>

          <p className={styles.sectionTitle}>
            2. Si... <span>(optionnel)</span>
          </p>

          <div className={styles.formGrid}>
            <label>
              Champ
              <input
                name="conditionField"
                placeholder="invoice.total"
              />
            </label>

            <label>
              Opérateur
              <select name="conditionOperator" defaultValue="EQUALS">
                <option value="EQUALS">Est égal à</option>
                <option value="NOT_EQUALS">N’est pas égal à</option>
                <option value="GREATER_THAN">Est supérieur à</option>
                <option value="LESS_THAN">Est inférieur à</option>
                <option value="CONTAINS">Contient</option>
              </select>
            </label>
          </div>

          <label>
            Valeur attendue
            <input name="conditionValue" placeholder="2000" />
          </label>

          <p className={styles.sectionTitle}>3. Alors...</p>

          <label>
            Action
            <select name="actionType" defaultValue="CREATE_TASK">
              <option value="CREATE_TASK">Créer une tâche</option>
              <option value="CREATE_NOTIFICATION">
                Créer une notification
              </option>
              <option value="ADD_CONTACT_NOTE">
                Ajouter une note CRM
              </option>
              <option value="UPDATE_CONTACT_STATUS">
                Modifier le statut CRM
              </option>
              <option value="WEBHOOK">Appeler un webhook</option>
            </select>
          </label>

          <label>
            Titre de l’action ou de la tâche
            <input
              name="actionTitle"
              placeholder="Relancer {{contact.first_name}}"
            />
          </label>

          <label>
            Message ou contenu
            <textarea
              name="actionMessage"
              placeholder="La facture {{invoice.number}} nécessite un suivi."
            />
          </label>

          <div className={styles.formGrid}>
            <label>
              Priorité
              <select name="actionPriority" defaultValue="MEDIUM">
                <option value="LOW">Basse</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </label>

            <label>
              Échéance dans
              <input
                name="actionDueDays"
                type="number"
                min="0"
                max="365"
                defaultValue="1"
              />
            </label>
          </div>

          <label>
            Nouveau statut CRM
            <select name="actionStatus" defaultValue="CONTACTED">
              <option value="PROSPECT">Prospect</option>
              <option value="CONTACTED">Contacté</option>
              <option value="MEETING">Rendez-vous</option>
              <option value="NEGOTIATION">Négociation</option>
              <option value="CUSTOMER">Client</option>
              <option value="LOST">Perdu</option>
            </select>
          </label>

          <label>
            URL du webhook
            <input
              name="webhookUrl"
              type="url"
              placeholder="https://..."
            />
          </label>

          <button className={styles.primaryButton} type="submit">
            Créer l’automatisation
          </button>
        </form>
      </section>
    </div>
  );
}
