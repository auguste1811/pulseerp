import { logoutAction } from "../logout";
import { Icon } from "./icons";

export function AppTopbar({
  firstName,
  lastName,
  role,
}: {
  firstName: string;
  lastName: string;
  role: string;
}) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <header className="app-topbar">
      <div className="topbar-search">
        <Icon name="search" size={18} />
        <input
          aria-label="Recherche globale"
          placeholder="Rechercher un client, une facture, une tâche..."
        />
        <kbd>⌘ K</kbd>
      </div>

      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Notifications">
          <Icon name="bell" size={19} />
          <span className="notification-dot" />
        </button>

        <div className="profile-summary">
          <span className="profile-avatar">{initials}</span>
          <div>
            <strong>{firstName} {lastName}</strong>
            <small>{role}</small>
          </div>
        </div>

        <form action={logoutAction}>
          <button className="logout-button" type="submit" aria-label="Déconnexion">
            <Icon name="logout" size={18} />
          </button>
        </form>
      </div>
    </header>
  );
}
