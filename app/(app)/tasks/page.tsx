import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { Icon } from "../components/icons";
import { createTask } from "./actions";

const columns = [
  { value: "TODO", label: "À faire" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "WAITING", label: "En attente" },
  { value: "DONE", label: "Terminées" },
];

export default async function Tasks() {
  const member = await currentContext();
  const rows = await query<any>(
    "SELECT * FROM tasks WHERE company_id=$1 ORDER BY created_at DESC",
    [member.company_id],
  );

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Organisation</p>
          <h1>Tâches</h1>
          <p>Organisez le travail de votre équipe avec une vue Kanban claire.</p>
        </div>
        <button className="primary-action" form="task-form" type="submit">
          <Icon name="plus" size={17}/> Nouvelle tâche
        </button>
      </section>

      <article className="dashboard-panel quick-task-panel">
        <form id="task-form" action={createTask} className="quick-task-form">
          <input name="title" placeholder="Que faut-il faire ?" required />
          <select name="status">{columns.map((column) => <option value={column.value} key={column.value}>{column.label}</option>)}</select>
          <select name="priority"><option value="LOW">Basse</option><option value="MEDIUM">Moyenne</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option></select>
          <input name="dueDate" type="date" />
          <button className="primary-action" type="submit">Ajouter</button>
        </form>
      </article>

      <section className="premium-kanban">
        {columns.map((column) => {
          const tasks = rows.filter((task) => task.status === column.value);
          return (
            <div className="kanban-column" key={column.value}>
              <div className="kanban-heading">
                <div><i className={`kanban-dot ${column.value.toLowerCase()}`} /><strong>{column.label}</strong></div>
                <span>{tasks.length}</span>
              </div>
              <div className="kanban-cards">
                {tasks.map((task) => (
                  <article className="kanban-card" key={task.id}>
                    <div className="kanban-card-top">
                      <span className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
                      <button type="button"><Icon name="more" size={17}/></button>
                    </div>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    <div className="kanban-card-footer">
                      <span><Icon name="calendar" size={14}/>{task.due_date ? new Date(task.due_date).toLocaleDateString("fr-FR") : "Sans date"}</span>
                      <span className="mini-avatar">{member.first_name[0]}{member.last_name[0]}</span>
                    </div>
                  </article>
                ))}
                <button className="add-card-button" type="button"><Icon name="plus" size={15}/> Ajouter une tâche</button>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
