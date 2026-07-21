"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function EnterpriseShell({
  children,
  companyName,
  firstName,
  lastName,
  role,
  enabledModules,
  isPlatformAdmin,
}: {
  children: React.ReactNode;
  companyName: string;
  firstName: string;
  lastName: string;
  role: string;
  enabledModules: string[];
  isPlatformAdmin: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`enterprise-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <AppSidebar
        companyName={companyName}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        enabledModules={enabledModules}
        isPlatformAdmin={isPlatformAdmin}
      />

      <div className="enterprise-main">
        <AppTopbar
          firstName={firstName}
          lastName={lastName}
          role={role}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((value) => !value)}
        />
        <main className="enterprise-content">{children}</main>
      </div>
    </div>
  );
}
