import { currentContext } from "@/lib/auth";
import { AppSidebar } from "./components/app-sidebar";
import { AppTopbar } from "./components/app-topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await currentContext();

  return (
    <div className="app-shell">
      <AppSidebar companyName={member.company_name} />
      <div className="app-main">
        <AppTopbar
          firstName={member.first_name}
          lastName={member.last_name}
          role={member.role}
        />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
