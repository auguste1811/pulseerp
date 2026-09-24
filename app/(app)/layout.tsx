import { currentContext } from "@/lib/auth";
import { EnterpriseShell } from "./components/enterprise-shell";
import { GmailAutoSync } from "./components/gmail-auto-sync";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await currentContext();

  return (
    <>
      <GmailAutoSync />
      <EnterpriseShell
        companyName={member.company_name}
        firstName={member.first_name}
        lastName={member.last_name}
        role={member.role}
        enabledModules={member.enabled_modules}
        isPlatformAdmin={member.is_platform_admin}
      >
        {children}
      </EnterpriseShell>
    </>
  );
}
