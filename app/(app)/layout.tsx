import { currentContext } from "@/lib/auth";
import { EnterpriseShell } from "./components/enterprise-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await currentContext();

  return (
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
  );
}
