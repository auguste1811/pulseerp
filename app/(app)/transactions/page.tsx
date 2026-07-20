import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../components/icons";
import { createTransaction } from "./actions";

export default async function Transactions() {
  const member = await currentContext();
  const rows = await query<any>(
    "SELECT * FROM transactions WHERE company_id=$1 ORDER BY date DESC, created_at DESC",
    [member.company_id],
  );

  const income = rows.filter((row) => row.type === "INCOME").reduce((s, row) => s + Number(row.amount_excluding_tax), 0);
  const expense = rows.filter((row) => row.type === "EXPENSE").reduce((s, row) => s + Number(row.amount_excluding_tax), 0);
  const vatCollected = rows.filter((row) => row.type === "INCOME").reduce((s, row) => s + Number(row.vat_amount), 0);
  const vatRecoverable = rows.filter((row) => row.type === "EXPENSE").reduce((s, row) => s + Number(row.vat_amount), 0);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Pilotage financier</p>
          <h1>Comptabilité</h1>
          <p>Suivez vos revenus, dépenses et votre TVA en temps réel.</p>
        </div>
        <button className="primary-action" form="transaction-form" type="submit">
          <Icon name="plus" size={17}/> Nouvelle opération
        </button>
      </section>

      <section className="mini-kpi-grid">
        <div><span>Revenus HT</span><strong>{euro(income)}</strong></div>
        <div><span>Dépenses HT</span><strong>{euro(expense)}</strong></div>
        <div><span>TVA collectée</span><strong>{euro(vatCollected)}</strong></div>
        <div><span>TVA récupérable</span><strong>{euro(vatRecoverable)}</strong></div>
      </section>

      <section className="module-grid">
        <article className="dashboard-panel form-panel">
          <div className="panel-header"><div><h2>Nouvelle opération</h2><p>Enregistrez un revenu ou une dépense.</p></div></div>
          <form id="transaction-form" action={createTransaction} className="premium-form">
            <label>Type
              <select name="type"><option value="INCOME">Revenu</option><option value="EXPENSE">Dépense</option></select>
            </label>
            <label>Date<input name="date" type="date" required /></label>
            <label>Libellé<input name="label" placeholder="Contrat Agence Nova" required /></label>
            <label>Catégorie<input name="category" placeholder="Vente, publicité, logiciel..." /></label>
            <div className="form-row">
              <label>Montant HT<input name="amount" type="number" step="0.01" min="0" required /></label>
              <label>TVA (%)<input name="vatRate" type="number" step="0.1" defaultValue="20" min="0" /></label>
            </div>
            <label>Statut
              <select name="status"><option value="PAID">Payé</option><option value="PENDING">En attente</option><option value="OVERDUE">Impayé</option></select>
            </label>
            <button className="primary-action full-width" type="submit">Enregistrer l’opération</button>
          </form>
        </article>

        <article className="dashboard-panel list-panel">
          <div className="panel-header">
            <div><h2>Historique des opérations</h2><p>{rows.length} mouvement{rows.length > 1 ? "s" : ""}</p></div>
            <button className="secondary-action" type="button">Exporter CSV</button>
          </div>
          <div className="transaction-list">
            {rows.map((row) => (
              <div className="transaction-row" key={row.id}>
                <span className={`transaction-avatar ${row.type.toLowerCase()}`}>{row.type === "INCOME" ? "↗" : "↘"}</span>
                <div className="transaction-main">
                  <strong>{row.label}</strong>
                  <small>{row.category || "Non classé"} · {new Date(row.date).toLocaleDateString("fr-FR")}</small>
                </div>
                <span className={`status-pill ${row.status.toLowerCase()}`}>
                  {row.status === "PAID" ? "Payé" : row.status === "OVERDUE" ? "Impayé" : "En attente"}
                </span>
                <strong className={row.type === "INCOME" ? "amount-positive" : "amount-negative"}>
                  {row.type === "INCOME" ? "+" : "-"}{euro(Number(row.amount_including_tax))}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
