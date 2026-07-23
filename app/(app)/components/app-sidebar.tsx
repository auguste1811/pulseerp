"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

type ModuleCode =
  | "DASHBOARD"
  | "REPORTS"
  | "CRM"
  | "ACQUISITION"
  | "BILLING"
  | "ACCOUNTING"
  | "TASKS"
  | "CALENDAR"
  | "DOCUMENTS"
  | "TEAM"
  | "AUTOMATIONS"
  | "INTEGRATIONS"
  | "NOTIFICATIONS"
  | "AI";

const groups = [
  {
    label: "Pilotage",
    items: [
      { code: "DASHBOARD", href: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
      { code: "REPORTS", href: "/reports", label: "Rapports", icon: "reports" },
    ],
  },
  {
    label: "Ventes",
    items: [
      { code: "CRM", href: "/contacts", label: "CRM", icon: "crm" },
      {
        code: "ACQUISITION",
        href: "/acquisition",
        label: "Sources d’acquisition",
        icon: "reports",
      },
      {
        code: "BILLING",
        href: "/billing",
        label: "Devis & factures",
        icon: "documents",
      },
      {
        code: "ACCOUNTING",
        href: "/transactions",
        label: "Comptabilité",
        icon: "accounting",
      },
    ],
  },
  {
    label: "Organisation",
    items: [
      { code: "TASKS", href: "/tasks", label: "Tâches", icon: "tasks" },
      { code: "CALENDAR", href: "/calendar", label: "Calendrier", icon: "calendar" },
      { code: "DOCUMENTS", href: "/documents", label: "Documents", icon: "documents" },
      { code: "TEAM", href: "/team", label: "Équipe", icon: "team" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { code: "AI", href: "/ai", label: "PulseAI", icon: "sparkles" },
      { code: "AUTOMATIONS", href: "/automations", label: "Automatisations", icon: "sparkles" },
      { code: "INTEGRATIONS", href: "/integrations", label: "App Center", icon: "settings" },
      { code: "NOTIFICATIONS", href: "/notifications", label: "Notifications", icon: "bell" },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{
    code: ModuleCode;
    href: string;
    label: string;
    icon: IconName;
  }>;
}>;

export function AppSidebar({
  companyName,
  collapsed,
  onToggle,
  enabledModules,
  isPlatformAdmin,
}: {
  companyName: string;
  collapsed: boolean;
  onToggle: () => void;
  enabledModules: string[];
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const allowed = new Set(enabledModules);

  return (
    <aside className="enterprise-sidebar">
      <div className="enterprise-brand">
        <span className="enterprise-logo">P</span>
        <div>
          <strong>PulseERP</strong>
          <small>Enterprise</small>
        </div>
        <button
          onClick={onToggle}
          type="button"
          aria-label="Replier la navigation"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <Link href="/companies" className="enterprise-company">
        <span>{companyName.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{companyName}</strong>
          <small>Espace principal</small>
        </div>
        <Icon name="arrowDown" size={15} />
      </Link>

      <div className="enterprise-nav-scroll">
        {isPlatformAdmin && (
          <section className="enterprise-nav-group admin-nav-group">
            <p>Plateforme</p>
            <nav>
              <Link
                className={pathname.startsWith("/admin") ? "active" : ""}
                href="/admin"
              >
                <Icon name="settings" size={19} />
                <span>Super administration</span>
                {pathname.startsWith("/admin") && <i />}
              </Link>
            </nav>
          </section>
        )}

        {groups.map((group) => {
          const items = group.items.filter((item) => allowed.has(item.code));
          if (items.length === 0) return null;

          return (
            <section className="enterprise-nav-group" key={group.label}>
              <p>{group.label}</p>
              <nav>
                {items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      title={item.label}
                      className={active ? "active" : ""}
                      href={item.href}
                      key={item.href}
                    >
                      <Icon name={item.icon} size={19} />
                      <span>{item.label}</span>
                      {active && <i />}
                    </Link>
                  );
                })}
              </nav>
            </section>
          );
        })}
      </div>

      <div className="enterprise-sidebar-footer">
        <Link href="/companies"><Icon name="dashboard" size={18}/><span>Mes entreprises</span></Link><Link href="/settings">
          <Icon name="settings" size={18} />
          <span>Paramètres</span>
        </Link>
        <div className="enterprise-plan">
          <strong>Accès personnalisé</strong>
          <small>{enabledModules.length} module(s) actif(s)</small>
        </div>
      </div>
    </aside>
  );
}
