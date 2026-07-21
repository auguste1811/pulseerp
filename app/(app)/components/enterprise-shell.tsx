"use client";
import Link from "next/link";
import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function EnterpriseShell({
 children,companyName,firstName,lastName,role,trialDaysRemaining,showTrialBanner
}:{
 children:React.ReactNode;
 companyName:string;
 firstName:string;
 lastName:string;
 role:string;
 trialDaysRemaining:number;
 showTrialBanner:boolean;
}){
 const [collapsed,setCollapsed]=useState(false);
 return <div className={`enterprise-shell ${collapsed?"sidebar-collapsed":""}`}>
  <AppSidebar companyName={companyName} collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)}/>
  <div className="enterprise-main">
   <AppTopbar firstName={firstName} lastName={lastName} role={role} collapsed={collapsed} onToggleSidebar={()=>setCollapsed(v=>!v)}/>
   {showTrialBanner && (
    <div className={`trial-banner ${trialDaysRemaining <= 1 ? "urgent" : ""}`}>
     <span>
      Essai gratuit : {trialDaysRemaining} jour{trialDaysRemaining > 1 ? "s" : ""} restant{trialDaysRemaining > 1 ? "s" : ""}.
     </span>
     <Link href="/subscribe">Choisir une offre</Link>
    </div>
   )}
   <main className="enterprise-content">{children}</main>
  </div>
 </div>
}
