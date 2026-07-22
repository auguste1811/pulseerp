import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Icon } from "../components/icons";
import { createTransaction } from "./actions";
import { changePurchaseStatus, classifyPurchaseInvoice, importPurchaseInvoice } from "./accounting-actions";
import { InvoiceAIButton } from "./invoice-ai-button";

const categoryLabels: Record<string, string> = {
  TO_CLASSIFY: "À classer", PURCHASES: "Achats", SUPPLIES: "Fournitures",
  SOFTWARE: "Logiciels", TELECOM: "Télécom", VEHICLE: "Véhicule",
  TRAVEL: "Déplacements", ADVERTISING: "Publicité", INSURANCE: "Assurance",
  BANK: "Banque", RENT: "Loyer", OTHER: "Divers",
};

export default async function Transactions({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const member = await currentContext();
  const feedback = await searchParams;
  const [rows, purchases, sales, entries] = await Promise.all([
    query<any>("SELECT * FROM transactions WHERE company_id=$1 ORDER BY date DESC, created_at DESC", [member.company_id]),
    query<any>(`SELECT id, supplier_name, invoice_number, issue_date, due_date, category, status,
      subtotal, vat_amount, total, original_name, mime_type, size_bytes,
      ocr_status, ocr_confidence, ocr_error
      FROM purchase_invoices WHERE company_id=$1 ORDER BY issue_date DESC, created_at DESC`, [member.company_id]),
    query<any>(`SELECT d.id, d.document_number, d.issue_date, d.status, d.subtotal, d.vat_amount, d.total,
      COALESCE(c.company_name, CONCAT(c.first_name,' ',c.last_name), 'Client') AS customer
      FROM sales_documents d LEFT JOIN contacts c ON c.id=d.contact_id
      WHERE d.company_id=$1 AND d.document_type='INVOICE'
      ORDER BY d.issue_date DESC`, [member.company_id]),
    query<any>(`SELECT journal, account_number, label, debit, credit, entry_date
      FROM accounting_entries WHERE company_id=$1 ORDER BY entry_date DESC, created_at DESC LIMIT 100`, [member.company_id]),
  ]);

  const income = rows.filter(r=>r.type==='INCOME').reduce((s,r)=>s+Number(r.amount_excluding_tax),0);
  const expense = rows.filter(r=>r.type==='EXPENSE').reduce((s,r)=>s+Number(r.amount_excluding_tax),0);
  const vatCollected = rows.filter(r=>r.type==='INCOME').reduce((s,r)=>s+Number(r.vat_amount),0);
  const vatRecoverable = rows.filter(r=>r.type==='EXPENSE').reduce((s,r)=>s+Number(r.vat_amount),0);

  return <>
    <section className="page-heading accounting-heading">
      <div><p className="eyebrow">Pilotage financier</p><h1>Comptabilité</h1>
        <p>Factures de vente, achats importés, TVA et écritures réunis au même endroit.</p></div>
      <div className="accounting-heading-actions">
        <a className="secondary-action" href="#manual-operation">Nouvelle opération</a>
        <a className="primary-action" href="#purchase-import"><Icon name="plus" size={17}/> Importer une facture</a>
      </div>
    </section>

    {feedback.imported && <div className="import-alert success"><strong>Facture importée.</strong><span>La dépense et ses écritures ont été créées automatiquement.</span></div>}
    {feedback.ocr === "validated" && <div className="import-alert success"><strong>Analyse OCR validée.</strong><span>La facture et les écritures comptables ont été mises à jour.</span></div>}
    {feedback.error && <div className="import-alert error"><strong>Import impossible.</strong><span>Vérifie le fichier et les informations saisies.</span></div>}

    <section className="mini-kpi-grid accounting-kpis">
      <div><span>Chiffre d’affaires HT</span><strong>{euro(income)}</strong><small>{sales.length} facture(s)</small></div>
      <div><span>Achats HT</span><strong>{euro(expense)}</strong><small>{purchases.length} pièce(s)</small></div>
      <div><span>Résultat estimé</span><strong>{euro(income-expense)}</strong><small>Avant autres charges</small></div>
      <div><span>TVA à décaisser</span><strong>{euro(vatCollected-vatRecoverable)}</strong><small>{euro(vatCollected)} collectée</small></div>
    </section>

    <section className="accounting-grid-top">
      <article className="dashboard-panel accounting-list-panel">
        <div className="panel-header"><div><h2>Factures de vente</h2><p>Synchronisées automatiquement depuis Devis & factures.</p></div><Link className="secondary-action" href="/billing">Ouvrir la facturation</Link></div>
        <div className="accounting-table-wrap"><table className="accounting-table"><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>HT</th><th>TVA</th><th>TTC</th><th>Statut</th></tr></thead>
        <tbody>{sales.map(row=><tr key={row.id}><td><Link href={`/billing/${row.id}`}>{row.document_number}</Link></td><td>{row.customer}</td><td>{new Date(row.issue_date).toLocaleDateString('fr-FR')}</td><td>{euro(Number(row.subtotal))}</td><td>{euro(Number(row.vat_amount))}</td><td><strong>{euro(Number(row.total))}</strong></td><td><span className={`status-pill ${String(row.status).toLowerCase()}`}>{row.status}</span></td></tr>)}</tbody></table></div>
      </article>

      <article id="purchase-import" className="dashboard-panel form-panel purchase-import-panel">
        <div className="panel-header"><div><h2>Importer une facture d’achat</h2><p>PDF, JPG ou PNG — 8 Mo maximum.</p></div></div>
        <form action={importPurchaseInvoice} className="premium-form" encType="multipart/form-data">
          <label className="file-drop">Pièce justificative<input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required/><span>Choisir le document</span></label>
          <div className="form-row"><label>Fournisseur<input name="supplierName" required placeholder="Orange, Amazon, EDF..."/></label><label>N° facture<input name="invoiceNumber"/></label></div>
          <div className="form-row"><label>Date<input name="issueDate" type="date" required/></label><label>Échéance<input name="dueDate" type="date"/></label></div>
          <label>Catégorie<select name="category" defaultValue="TO_CLASSIFY">{Object.entries(categoryLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
          <div className="form-row three"><label>HT<input name="subtotal" type="number" step="0.01" min="0" required/></label><label>TVA<input name="vatAmount" type="number" step="0.01" min="0" required/></label><label>TTC<input name="total" type="number" step="0.01" min="0.01" required/></label></div>
          <label>Statut<select name="status"><option value="PENDING">À payer</option><option value="PAID">Payée</option><option value="OVERDUE">En retard</option></select></label>
          <label>Notes<textarea name="notes" rows={2}/></label>
          <button className="primary-action full-width" type="submit">Importer et comptabiliser</button>
        </form>
      </article>
    </section>

    <article className="dashboard-panel accounting-list-panel purchase-list-panel">
      <div className="panel-header"><div><h2>Factures d’achat</h2><p>Classez les pièces et suivez leur règlement.</p></div><span className="soft-badge">{purchases.filter(p=>p.category==='TO_CLASSIFY').length} à classer</span></div>
      <div className="accounting-table-wrap"><table className="accounting-table purchase-table"><thead><tr><th>Document</th><th>Fournisseur</th><th>Date</th><th>Catégorie</th><th>Statut</th><th>TTC</th><th></th></tr></thead>
      <tbody>{purchases.map(row=><tr key={row.id}><td><a href={`/api/accounting/purchases/${row.id}/download`} target="_blank">{row.original_name}</a><small>{Math.ceil(Number(row.size_bytes)/1024)} Ko</small></td><td><strong>{row.supplier_name}</strong><small>{row.invoice_number||'Sans numéro'}</small></td><td>{new Date(row.issue_date).toLocaleDateString('fr-FR')}</td>
      <td><form action={classifyPurchaseInvoice} className="inline-accounting-form"><input type="hidden" name="id" value={row.id}/><select name="category" defaultValue={row.category}>{Object.entries(categoryLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><button type="submit">Classer</button></form></td>
      <td><form action={changePurchaseStatus} className="inline-accounting-form"><input type="hidden" name="id" value={row.id}/><select name="status" defaultValue={row.status}><option value="PENDING">À payer</option><option value="PAID">Payée</option><option value="OVERDUE">En retard</option></select><button type="submit">OK</button></form></td>
      <td><strong>{euro(Number(row.total))}</strong></td><td><div style={{display:"flex",gap:6,alignItems:"center"}}><InvoiceAIButton id={row.id} status={row.ocr_status}/><a className="icon-link" href={`/api/accounting/purchases/${row.id}/download`} target="_blank">Voir</a></div></td></tr>)}</tbody></table></div>
    </article>

    <section className="module-grid accounting-bottom-grid">
      <article id="manual-operation" className="dashboard-panel form-panel"><div className="panel-header"><div><h2>Opération manuelle</h2><p>Pour les mouvements sans facture.</p></div></div>
      <form id="transaction-form" action={createTransaction} className="premium-form"><label>Type<select name="type"><option value="INCOME">Revenu</option><option value="EXPENSE">Dépense</option></select></label><label>Date<input name="date" type="date" required/></label><label>Libellé<input name="label" required/></label><label>Catégorie<input name="category"/></label><label>Source du revenu<input name="revenueSource" placeholder="Optionnel pour les revenus"/></label><div className="form-row"><label>Montant HT<input name="amount" type="number" step="0.01" min="0" required/></label><label>TVA (%)<input name="vatRate" type="number" step="0.1" defaultValue="20" min="0"/></label></div><label>Statut<select name="status"><option value="PAID">Payé</option><option value="PENDING">En attente</option><option value="OVERDUE">Impayé</option></select></label><button className="primary-action full-width">Enregistrer</button></form></article>
      <article className="dashboard-panel accounting-list-panel"><div className="panel-header"><div><h2>Écritures d’achat</h2><p>Journal ACH généré automatiquement.</p></div></div><div className="accounting-entries">{entries.map((e,i)=><div className="accounting-entry" key={`${e.account_number}-${i}`}><span>{e.journal}</span><strong>{e.account_number}</strong><div><b>{e.label}</b><small>{new Date(e.entry_date).toLocaleDateString('fr-FR')}</small></div><em>{Number(e.debit)>0?`Débit ${euro(Number(e.debit))}`:`Crédit ${euro(Number(e.credit))}`}</em></div>)}</div></article>
    </section>
  </>;
}
