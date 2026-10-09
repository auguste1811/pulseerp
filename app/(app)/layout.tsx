import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { EnterpriseShell } from "./components/enterprise-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await currentContext();
  const subscription = member.subscription;

  const showTrialBanner =
    subscription.isTrial && subscription.daysRemaining <= 7;

  return (
    <EnterpriseShell
      companyName={member.company_name}
      companyLogoUrl={member.company_logo_url ?? null}
      firstName={member.first_name}
      lastName={member.last_name}
      role={member.role}
      enabledModules={member.enabled_modules}
      isPlatformAdmin={member.is_platform_admin}
    >
      {showTrialBanner && (
        <div className="import-alert" style={{ marginBottom: 14 }}>
          <strong>
            Essai gratuit : {subscription.daysRemaining} jour
            {subscription.daysRemaining > 1 ? "s" : ""} restant
            {subscription.daysRemaining > 1 ? "s" : ""}.
          </strong>
          <span>
            <Link href="/subscribe"> Choisir une formule</Link> pour éviter toute
            interruption.
          </span>
        </div>
      )}
      {children}
    </EnterpriseShell>
  );
}
