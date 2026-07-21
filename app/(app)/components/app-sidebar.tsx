"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
const groups=[
 {label:"Pilotage",items:[{href:"/dashboard",label:"Tableau de bord",icon:"dashboard"},{href:"/reports",label:"Rapports",icon:"reports"}]},
 {label:"Ventes",items:[{href:"/contacts",label:"CRM",icon:"crm"},{href:"/billing",label:"Devis & factures",icon:"documents"},{href:"/transactions",label:"Comptabilité",icon:"accounting"}]},
 {label:"Organisation",items:[{href:"/tasks",label:"Tâches",icon:"tasks"},{href:"/calendar",label:"Calendrier",icon:"calendar"},{href:"/documents",label:"Documents",icon:"documents"},{href:"/team",label:"Équipe",icon:"team"}]},
 {label:"Intelligence",items:[{href:"/ai",label:"PulseAI",icon:"sparkles"},{href:"/automations",label:"Automatisations",icon:"sparkles"},{href:"/integrations",label:"App Center",icon:"settings"},{href:"/notifications",label:"Notifications",icon:"bell"}]},
] satisfies Array<{label:string;items:Array<{href:string;label:string;icon:IconName}>}>;
export function AppSidebar({companyName,collapsed,onToggle}:{companyName:string;collapsed:boolean;onToggle:()=>void}){const pathname=usePathname();return <aside className="enterprise-sidebar">
 <div className="enterprise-brand"><span className="enterprise-logo">P</span><div><strong>PulseERP</strong><small>Enterprise</small></div><button onClick={onToggle} type="button" aria-label="Replier la navigation">{collapsed?"›":"‹"}</button></div>
 <div className="enterprise-company"><span>{companyName.slice(0,1).toUpperCase()}</span><div><strong>{companyName}</strong><small>Espace principal</small></div><Icon name="arrowDown" size={15}/></div>
 <div className="enterprise-nav-scroll">{groups.map(group=><section className="enterprise-nav-group" key={group.label}><p>{group.label}</p><nav>{group.items.map(item=>{const active=pathname.startsWith(item.href);return <Link title={item.label} className={active?"active":""} href={item.href} key={item.href}><Icon name={item.icon} size={19}/><span>{item.label}</span>{active&&<i/>}</Link>})}</nav></section>)}</div>
 <div className="enterprise-sidebar-footer"><Link href="/settings"><Icon name="settings" size={18}/><span>Paramètres</span></Link><div className="enterprise-plan"><strong>Plan Premium</strong><small>14 jours d’essai</small></div></div>
 </aside>}
