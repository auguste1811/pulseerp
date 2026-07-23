import { currentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCompany, switchCompany } from "./actions";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const member = await currentContext();
  const feedback = await searchParams;
  const memberships = await prisma.companyMember.findMany({
    where: { userId: member.user_id }, include: { company: true }, orderBy: { company: { name: "asc" } },
  });
  return <>
    <section className="page-heading"><div><p className="eyebrow">Espaces de travail</p><h1>Mes entreprises</h1><p>Créez plusieurs entreprises et basculez de l’une à l’autre sans changer de compte.</p></div></section>
    {feedback.error && <div className="import-alert error"><strong>Action impossible.</strong><span>Vérifiez les informations ou vos droits.</span></div>}
    <section className="company-workspace-grid">
      <article className="dashboard-panel"><div className="panel-header"><div><h2>Entreprises accessibles</h2><p>{memberships.length} espace(s) associé(s) à votre compte</p></div></div>
        <div className="company-workspace-list">{memberships.map((membership) => <form action={switchCompany} key={membership.companyId}>
          <input type="hidden" name="companyId" value={membership.companyId}/>
          <div><span>{membership.company.name.slice(0,1).toUpperCase()}</span><div><strong>{membership.company.name}</strong><small>{membership.role}{membership.companyId===member.company_id ? " · Entreprise active" : ""}</small></div></div>
          <button className={membership.companyId===member.company_id ? "secondary-action" : "primary-action"} type="submit" disabled={membership.companyId===member.company_id}>{membership.companyId===member.company_id ? "Active" : "Ouvrir"}</button>
        </form>)}</div>
      </article>
      <article className="dashboard-panel"><div className="panel-header"><div><h2>Créer une entreprise</h2><p>Un nouvel espace indépendant avec ses propres données.</p></div></div>
        <form action={createCompany} className="premium-form"><label>Nom de l’entreprise<input name="name" placeholder="Nouvelle société" required/></label><button className="primary-action" type="submit">Créer et ouvrir l’entreprise</button></form>
      </article>
    </section>
  </>;
}
