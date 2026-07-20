import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { Icon } from "../../components/icons";
import { PipelineBoard } from "./pipeline-board";

export default async function CrmPipeline() {
  const member = await currentContext();
  const contacts = await query<any>(
    `
    SELECT id, first_name, last_name, company_name, email,
           status, value, priority, tags
    FROM contacts
    WHERE company_id = $1
    ORDER BY updated_at DESC, created_at DESC
    `,
    [member.company_id],
  );

  const pipelineValue = contacts
    .filter((contact) => !["CUSTOMER", "LOST"].includes(contact.status))
    .reduce((sum, contact) => sum + Number(contact.value || 0), 0);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">CRM Pro</p>
          <h1>Pipeline commercial</h1>
          <p>Déplacez les opportunités entre les étapes par glisser-déposer.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-action" href="/contacts">Vue contacts</Link>
          <Link className="primary-action" href="/contacts">
            <Icon name="plus" size={17} />
            Nouveau contact
          </Link>
        </div>
      </section>

      <section className="pipeline-summary">
        <div><span>Opportunités</span><strong>{contacts.length}</strong></div>
        <div><span>Valeur du pipeline</span><strong>{pipelineValue.toLocaleString("fr-FR")} €</strong></div>
        <div><span>Clients gagnés</span><strong>{contacts.filter((c) => c.status === "CUSTOMER").length}</strong></div>
      </section>

      <PipelineBoard initialContacts={contacts} />
    </>
  );
}
