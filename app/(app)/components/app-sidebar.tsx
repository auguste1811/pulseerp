"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const primary = [
  { href: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
  { href: "/contacts", label: "CRM Pro", icon: "crm" },
  { href: "/transactions", label: "Comptabilité", icon: "accounting" },
  { href: "/billing", label: "Devis & factures", icon: "documents" },
  { href: "/tasks", label: "Tâches", icon: "tasks" },
] satisfies Array<{ href: string; label: string; icon: IconName }>;

const secondary = [
  { href: "#", label: "Calendrier", icon: "calendar", soon: true },
  { href: "#", label: "Documents", icon: "documents", soon: true },
  { href: "#", label: "Équipe", icon: "team", soon: true },
  { href: "#", label: "Rapports", icon: "reports", soon: true },
] satisfies Array<{ href: string; label: string; icon: IconName; soon: true }>;

export function AppSidebar({
  companyName,
}: {
  companyName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">P</span>
        <div>
          <strong>PulseERP</strong>
          <small>Business OS</small>
        </div>
      </div>

      <div className="company-switcher">
        <span className="company-logo">{companyName.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{companyName}</strong>
          <small>Espace principal</small>
        </div>
        <Icon name="arrowDown" size={16} />
      </div>

      <p className="sidebar-label">Pilotage</p>
      <nav className="sidebar-nav">
        {primary.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link className={active ? "active" : ""} href={item.href} key={item.href}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {active && <span className="active-dot" />}
            </Link>
          );
        })}
      </nav>

      <p className="sidebar-label">Organisation</p>
      <nav className="sidebar-nav">
        {secondary.map((item) => (
          <span className="disabled-nav" key={item.label}>
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
            <small>Bientôt</small>
          </span>
        ))}
      </nav>

      <div className="sidebar-upgrade">
        <span className="upgrade-icon"><Icon name="sparkles" size={18} /></span>
        <strong>Passez à Pulse Pro</strong>
        <p>Automatisations, rapports avancés et intégrations.</p>
        <button type="button">Découvrir Pro</button>
      </div>
    </aside>
  );
}
