import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { euro } from "@/lib/format";

export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 const member=await currentContext(); const params=await searchParams; const term=(params.q||"").trim();
 if(term.length<2) return <><section className="page-heading"><div><p className="eyebrow">Recherche globale</p><h1>Rechercher dans PulseERP</h1><p>Saisissez au moins deux caractères dans la barre de recherche.</p></div></section></>;
 const like=`%${term}%`;
 const [contacts,documents,transactions,tasks,events,files]=await Promise.all([
  query<any>(`SELECT id,first_name,last_name,company_name,email,phone,status FROM contacts WHERE company_id=$1 AND (first_name ILIKE $2 OR last_name ILIKE $2 OR company_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2) ORDER BY updated_at DESC LIMIT 10`,[member.company_id,like]),
  query<any>(`SELECT d.id,d.document_number AS number,d.document_type,d.status,d.total,c.first_name,c.last_name,c.company_name FROM sales_documents d LEFT JOIN contacts c ON c.id=d.contact_id WHERE d.company_id=$1 AND (d.document_number ILIKE $2 OR c.first_name ILIKE $2 OR c.last_name ILIKE $2 OR c.company_name ILIKE $2) ORDER BY d.created_at DESC LIMIT 10`,[member.company_id,like]),
  query<any>(`SELECT id,label,category,type,status,amount_including_tax,date FROM transactions WHERE company_id=$1 AND (label ILIKE $2 OR category ILIKE $2 OR revenue_source ILIKE $2) ORDER BY date DESC LIMIT 10`,[member.company_id,like]),
  query<any>(`SELECT id,title,status,priority,due_date FROM tasks WHERE company_id=$1 AND (title ILIKE $2 OR description ILIKE $2) ORDER BY created_at DESC LIMIT 10`,[member.company_id,like]),
  query<any>(`SELECT id,title,start_at,location,status FROM calendar_events WHERE company_id=$1 AND (title ILIKE $2 OR description ILIKE $2 OR location ILIKE $2) ORDER BY start_at DESC LIMIT 10`,[member.company_id,like]),
  query<any>(`SELECT id,name,original_name,category FROM documents WHERE company_id=$1 AND (name ILIKE $2 OR original_name ILIKE $2 OR category ILIKE $2) ORDER BY created_at DESC LIMIT 10`,[member.company_id,like]),
 ]);
 const total=contacts.length+documents.length+transactions.length+tasks.length+events.length+files.length;
 const Section=({title,children,count}:{title:string;children:React.ReactNode;count:number})=><article className="dashboard-panel search-result-section"><div className="panel-header"><div><h2>{title}</h2><p>{count} résultat(s)</p></div></div>{children}</article>;
 return <><section className="page-heading"><div><p className="eyebrow">Recherche globale</p><h1>Résultats pour « {term} »</h1><p>{total} élément(s) trouvé(s) dans l’entreprise active.</p></div></section><section className="search-results-grid">
 <Section title="Contacts" count={contacts.length}><div className="search-result-list">{contacts.map(x=><Link href={`/contacts/${x.id}`} key={x.id}><strong>{x.first_name} {x.last_name}</strong><small>{x.company_name||x.email||x.phone||x.status}</small></Link>)}</div></Section>
 <Section title="Devis et factures" count={documents.length}><div className="search-result-list">{documents.map(x=><Link href={`/billing/${x.id}`} key={x.id}><strong>{x.number}</strong><small>{x.document_type} · {x.status} · {euro(Number(x.total))}</small></Link>)}</div></Section>
 <Section title="Comptabilité" count={transactions.length}><div className="search-result-list">{transactions.map(x=><Link href="/transactions" key={x.id}><strong>{x.label}</strong><small>{x.category||x.type} · {euro(Number(x.amount_including_tax))}</small></Link>)}</div></Section>
 <Section title="Tâches" count={tasks.length}><div className="search-result-list">{tasks.map(x=><Link href="/tasks" key={x.id}><strong>{x.title}</strong><small>{x.status} · {x.priority}</small></Link>)}</div></Section>
 <Section title="Calendrier" count={events.length}><div className="search-result-list">{events.map(x=><Link href={`/calendar/${x.id}`} key={x.id}><strong>{x.title}</strong><small>{new Date(x.start_at).toLocaleString("fr-FR")} · {x.location||"Sans lieu"}</small></Link>)}</div></Section>
 <Section title="Documents" count={files.length}><div className="search-result-list">{files.map(x=><Link href="/documents" key={x.id}><strong>{x.name||x.original_name}</strong><small>{x.category||"Document"}</small></Link>)}</div></Section>
 </section></>;
}
