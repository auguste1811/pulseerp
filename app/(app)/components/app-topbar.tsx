"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { logoutAction } from "../logout";
import { Icon } from "./icons";
export function AppTopbar({firstName,lastName,role,onToggleSidebar}:{firstName:string;lastName:string;role:string;collapsed:boolean;onToggleSidebar:()=>void}){
 const initials=`${firstName[0]??""}${lastName[0]??""}`.toUpperCase(); const inputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();inputRef.current?.focus();}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
 return <header className="enterprise-topbar">
 <div className="enterprise-topbar-left"><button className="enterprise-mobile-menu" onClick={onToggleSidebar} type="button">☰</button><form className="enterprise-global-search" action="/search" method="get"><Icon name="search" size={18}/><input ref={inputRef} name="q" placeholder="Rechercher contacts, factures, tâches, rendez-vous..."/><kbd>⌘ K</kbd></form></div>
 <div className="enterprise-topbar-actions"><Link className="enterprise-quick-create" href="/contacts">＋ Créer</Link><Link className="enterprise-icon-action" href="/calendar" aria-label="Calendrier"><Icon name="calendar" size={19}/></Link><Link className="enterprise-icon-action" href="/notifications" aria-label="Notifications"><Icon name="bell" size={19}/><i/></Link><details className="enterprise-profile"><summary><span className="enterprise-profile-avatar">{initials}</span><div><strong>{firstName} {lastName}</strong><small>{role}</small></div><Icon name="arrowDown" size={14}/></summary><div className="enterprise-profile-menu"><Link href="/companies">Mes entreprises</Link><Link href="/settings">Mon profil</Link><Link href="/team">Mon équipe</Link><form action={logoutAction}><button type="submit"><Icon name="logout" size={16}/>Déconnexion</button></form></div></details></div>
 </header>}
