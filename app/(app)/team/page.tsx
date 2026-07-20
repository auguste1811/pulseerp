import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManageMembers } from "@/lib/permissions";
import { TeamManager } from "./components/team-manager";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const member = await currentContext();
  const feedback = await searchParams;

  const members = await query<any>(
    `
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.is_active,
      u.last_login_at,
      cm.role,
      COUNT(t.id)::int AS assigned_tasks
    FROM company_members cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN tasks t
      ON t.assigned_user_id = u.id
      AND t.company_id = cm.company_id
      AND t.status <> 'DONE'
    WHERE cm.company_id = $1
    GROUP BY u.id, cm.role
    ORDER BY
      CASE cm.role
        WHEN 'OWNER' THEN 1
        WHEN 'ADMIN' THEN 2
        WHEN 'MANAGER' THEN 3
        WHEN 'EMPLOYEE' THEN 4
        ELSE 5
      END,
      u.last_name,
      u.first_name
    `,
    [member.company_id],
  );

  return (
    <>
      {(feedback.created || feedback.saved || feedback.removed) && (
        <div className="import-alert success">
          <strong>Modification enregistrée.</strong>
          <span>L’équipe a été mise à jour.</span>
        </div>
      )}

      {feedback.error && (
        <div className="import-alert error">
          <strong>Action impossible.</strong>
          <span>
            {feedback.error === "exists"
              ? "Cet utilisateur appartient déjà à l’entreprise."
              : feedback.error === "self"
                ? "Vous ne pouvez pas désactiver ou retirer votre propre compte."
                : "Vérifiez les informations saisies."}
          </span>
        </div>
      )}

      <TeamManager
        canManage={canManageMembers(member.role)}
        members={members}
      />
    </>
  );
}
