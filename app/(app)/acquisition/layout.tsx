import { currentContext } from "@/lib/auth";
import { requireCompanyModule } from "@/lib/platform-access";

export default async function AcquisitionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await currentContext();
  await requireCompanyModule(member.company_id, "ACQUISITION");
  return children;
}
