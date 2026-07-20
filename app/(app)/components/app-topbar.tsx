"use client";
import Link from "next/link";
import { logoutAction } from "../logout";
import { Icon } from "./icons";
export function AppTopbar({firstName,lastName,role,onToggleSidebar}:{firstName:string;lastName:string;role:string;collapsed:boolean;onToggleSidebar:()=>void}){const initials=`${firstName[0]??""}${lastName[0]??""}`.toUpperCase();return <header className="enterprise-topbar">
 <div className="enterprise-topbar-left"><button className="enterprise-mobile-menu" onClick={onToggleSidebar} type="button">☰</button><div className="enterprise-global-search"><Icon name="search" size={18}/><input placeholder="Rechercher partout dans PulseERP..."/><kbd>⌘ K</kbd></div></div>
 <div className="enterprise-topbar-actions"><Link className="enterprise-quick-create" href="/contacts">＋ Créer</Link><Link className="enterprise-icon-action" href="/calendar" aria-label="Calendrier"><Icon name="calendar" size={19}/></Link><Link className="enterprise-icon-action" href="/notifications" aria-label="Notifications"><Icon name="bell" size={19}/><i/></Link><details className="enterprise-profile"><summary><span className="enterprise-profile-avatar">{initials}</span><div><strong>{firstName} {lastName}</strong><small>{role}</small></div><Icon name="arrowDown" size={14}/></summary><div className="enterprise-profile-menu"><Link href="/settings">Mon profil</Link><Link href="/team">Mon équipe</Link><form action={logoutAction}><button type="submit"><Icon name="logout" size={16}/>Déconnexion</button></form></div></details></div>
 </header>}
