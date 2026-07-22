import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";
import { Button, Card, CardHeader, PageHeader, StatCard, Badge } from "@/components/ui";
import { Icon } from "../components/icons";
import { RevenueChart } from "./components/revenue-chart";
import { createManualRevenue } from "./actions";
export default async function Dashboard({searchParams}:{searchParams:Promise<{revenueCreated?:string;revenueError?:string}>}){const feedback=await searchParams;const member=await currentContext();const [transactions,contacts,tasks,events,docs]=await Promise.all([query<any>("SELECT * FROM transactions WHERE company_id=$1 ORDER BY date DESC,created_at DESC LIMIT 20",[member.company_id]),query<{count:string}>("SELECT COUNT(*)::text count FROM contacts WHERE company_id=$1",[member.company_id]),query<any>("SELECT * FROM tasks WHERE company_id=$1 ORDER BY created_at DESC",[member.company_id]),query<any>("SELECT * FROM calendar_events WHERE company_id=$1 AND start_at>=NOW() ORDER BY start_at LIMIT 4",[member.company_id]),query<{count:string}>("SELECT COUNT(*)::text count FROM documents WHERE company_id=$1",[member.company_id])]);const income=transactions.filter(x=>x.type==="INCOME").reduce((s,x)=>s+Number(x.amount_including_tax),0);const expenses=transactions.filter(x=>x.type==="EXPENSE").reduce((s,x)=>s+Number(x.amount_including_tax),0);const open=tasks.filter(x=>x.status!=="DONE");return <>
<PageHeader eyebrow="Vue d’ensemble" title={<>Bonjour {member.first_name} <span>👋</span></>} description="Pilotez les chiffres, les échéances et l’activité de votre entreprise depuis un seul espace." actions={<><Button variant="secondary">Exporter</Button><Button href="/transactions"><Icon name="plus" size={16}/> Nouvelle opération</Button></>}/>
{feedback.revenueCreated&&<div className="import-alert success"><strong>Revenu ajouté.</strong><span>Il apparaît maintenant dans le chiffre d’affaires et la comptabilité.</span></div>}
{feedback.revenueError&&<div className="import-alert error"><strong>Ajout impossible.</strong><span>Vérifiez les informations saisies.</span></div>}
<section className="pe-stat-grid"><StatCard label="Chiffre d’affaires" value={euro(income)} caption="Revenus enregistrés" icon={<Icon name="revenue"/>}/><StatCard label="Dépenses" value={euro(expenses)} caption="Charges enregistrées" icon={<Icon name="wallet"/>} tone="orange"/><StatCard label="Résultat net" value={euro(income-expenses)} caption="Marge actuelle" icon={<Icon name="profit"/>} tone="green"/><StatCard label="Clients actifs" value={contacts[0]?.count??"0"} caption={`${docs[0]?.count??"0"} documents`} icon={<Icon name="users"/>} tone="blue"/></section>
<section className="pe-dashboard-grid"><Card className="pe-chart-card"><CardHeader title="Performance financière" description="Évolution du chiffre d’affaires sur la période" action={<Badge tone="success">+12,8 %</Badge>}/><RevenueChart/></Card><Card className="pe-focus-card"><CardHeader title="À traiter aujourd’hui" description={`${open.length} tâche(s) encore ouvertes`}/><div className="pe-focus-list">{open.slice(0,5).map(task=><Link href="/tasks" key={task.id}><span className={`pe-priority-dot ${String(task.priority).toLowerCase()}`}/><div><strong>{task.title}</strong><small>{task.due_date?new Date(task.due_date).toLocaleDateString("fr-FR"):"Sans échéance"}</small></div><Badge tone={task.priority==="HIGH"?"danger":"neutral"}>{task.priority}</Badge></Link>)}{open.length===0&&<div className="pe-empty">Toutes les tâches sont terminées.</div>}</div></Card></section>

<section className="pe-dashboard-grid pe-manual-revenue-grid">
  <Card>
    <CardHeader
      title="Ajouter un revenu manuel"
      description="Ajoutez un revenu qui ne provient pas encore d’une facture."
    />
    <form action={createManualRevenue} className="premium-form">
      <div className="form-row">
        <label>Date<input name="date" type="date" required /></label>
        <label>Statut
          <select name="status" defaultValue="PAID">
            <option value="PAID">Encaissé</option>
            <option value="PENDING">À encaisser</option>
          </select>
        </label>
      </div>
      <label>Libellé<input name="label" placeholder="Prestation, vente, commission..." required /></label>
      <div className="form-row">
        <label>Source du revenu
          <input name="revenueSource" placeholder="Vente directe, apporteur, boutique..." required />
        </label>
        <label>Catégorie<input name="category" placeholder="Prestations, produits..." /></label>
      </div>
      <div className="form-row">
        <label>Montant HT<input name="amount" type="number" step="0.01" min="0.01" required /></label>
        <label>TVA (%)<input name="vatRate" type="number" step="0.1" min="0" defaultValue="20" /></label>
      </div>
      <button className="primary-action" type="submit">Ajouter au chiffre d’affaires</button>
    </form>
  </Card>
  <Card>
    <CardHeader
      title="Répartition des revenus"
      description="Les revenus manuels sont visibles dans la comptabilité."
      action={<Link className="pe-text-link" href="/transactions">Voir la comptabilité →</Link>}
    />
    <div className="manual-revenue-info">
      <strong>{euro(income)}</strong>
      <span>Revenus enregistrés au total</span>
      <p>
        Utilisez le champ « Source du revenu » pour distinguer les ventes
        directes, commissions, partenariats ou autres apports.
      </p>
    </div>
  </Card>
</section>

<section className="pe-dashboard-grid pe-dashboard-lower"><Card><CardHeader title="Dernières opérations" description="Les mouvements financiers récents" action={<Link className="pe-text-link" href="/transactions">Tout afficher →</Link>}/><div className="pe-table-wrap"><table className="pe-table"><thead><tr><th>Opération</th><th>Catégorie</th><th>Statut</th><th>Montant</th></tr></thead><tbody>{transactions.slice(0,6).map(item=><tr key={item.id}><td><strong>{item.label}</strong><small>{new Date(item.date).toLocaleDateString("fr-FR")}</small></td><td>{item.category||"Non classé"}</td><td><Badge tone={item.status==="PAID"?"success":"warning"}>{item.status}</Badge></td><td className={item.type==="INCOME"?"pe-positive":"pe-negative"}>{item.type==="INCOME"?"+":"-"}{euro(Number(item.amount_including_tax))}</td></tr>)}</tbody></table></div></Card><Card><CardHeader title="Agenda à venir" description="Vos prochains rendez-vous" action={<Link className="pe-text-link" href="/calendar">Calendrier →</Link>}/><div className="pe-agenda-list">{events.map(event=><Link href={`/calendar/${event.id}`} key={event.id}><time><strong>{new Date(event.start_at).getDate()}</strong><small>{new Date(event.start_at).toLocaleDateString("fr-FR",{month:"short"})}</small></time><div><strong>{event.title}</strong><small>{new Date(event.start_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} · {event.location||"À définir"}</small></div><span>→</span></Link>)}{events.length===0&&<div className="pe-empty">Aucun événement à venir.</div>}</div></Card></section>
</>}
