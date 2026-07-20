"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/icons";
import {
  createTeamMember,
  removeMember,
  toggleMemberActive,
  updateMemberRole,
} from "../actions";
import styles from "./team-manager.module.css";

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  role: string;
  assigned_tasks: number;
};

const roleLabels: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  EMPLOYEE: "Employé",
  VIEWER: "Lecture seule",
};

function relativeLastLogin(value: string | null): string {
  if (!value) return "Jamais";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days === 1) return "Hier";
  return `Il y a ${days} j`;
}

function roleClass(role: string): string {
  const map: Record<string, string> = {
    OWNER: styles.owner,
    ADMIN: styles.admin,
    MANAGER: styles.manager,
    EMPLOYEE: styles.employee,
    VIEWER: styles.viewer,
  };
  return map[role] ?? styles.viewer;
}

export function TeamManager({
  members,
  canManage,
}: {
  members: TeamMember[];
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!inviteOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInviteOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [inviteOpen]);

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return members.filter((member) => {
      const searchMatch =
        !normalized ||
        `${member.first_name} ${member.last_name}`.toLowerCase().includes(normalized) ||
        member.email.toLowerCase().includes(normalized) ||
        (roleLabels[member.role] ?? member.role).toLowerCase().includes(normalized);

      const filterMatch =
        filter === "ALL" ||
        (filter === "ACTIVE" && member.is_active) ||
        (filter === "INACTIVE" && !member.is_active);

      return searchMatch && filterMatch;
    });
  }, [members, query, filter]);

  const activeMembers = members.filter((member) => member.is_active).length;
  const admins = members.filter((member) =>
    ["OWNER", "ADMIN"].includes(member.role),
  ).length;
  const openTasks = members.reduce(
    (sum, member) => sum + Number(member.assigned_tasks),
    0,
  );
  const latestLogin = [...members]
    .filter((member) => member.last_login_at)
    .sort(
      (a, b) =>
        new Date(b.last_login_at!).getTime() -
        new Date(a.last_login_at!).getTime(),
    )[0];

  const maxTasks = Math.max(
    1,
    ...members.map((member) => Number(member.assigned_tasks)),
  );

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.headerTitleRow}>
            <h1>Équipe</h1>
            <span>Gérez les membres de votre entreprise</span>
          </div>
        </div>

        {canManage && (
          <button
            className={styles.inviteButton}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setInviteOpen(true);
            }}
          >
            <Icon name="plus" size={18} />
            Inviter un membre
          </button>
        )}
      </section>

      <section className={styles.stats}>
        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.purple}`}>
            <Icon name="users" size={26} />
          </span>
          <div className={styles.statContent}>
            <small>Membres actifs</small>
            <strong>{activeMembers}</strong>
            <em>Sur {members.length} membre{members.length > 1 ? "s" : ""}</em>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.blue}`}>
            <Icon name="settings" size={26} />
          </span>
          <div className={styles.statContent}>
            <small>Administrateurs</small>
            <strong>{admins}</strong>
            <em>Avec droits avancés</em>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.green}`}>
            <Icon name="tasks" size={26} />
          </span>
          <div className={styles.statContent}>
            <small>Tâches ouvertes</small>
            <strong>{openTasks}</strong>
            <em>Assignées à l’équipe</em>
          </div>
        </article>

        <article className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.orange}`}>
            <Icon name="clock" size={26} />
          </span>
          <div className={styles.statContent}>
            <small>Dernière connexion</small>
            <strong className={styles.compact}>
              {hydrated && latestLogin
                ? relativeLastLogin(latestLogin.last_login_at)
                : latestLogin
                  ? "Connexion récente"
                  : "Aucune"}
            </strong>
            <em>
              {latestLogin
                ? `${latestLogin.first_name} ${latestLogin.last_name}`
                : "Aucun membre connecté"}
            </em>
          </div>
        </article>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2>Membres de l’entreprise</h2>
            <p>{members.length} membre{members.length > 1 ? "s" : ""} au total</p>
          </div>

          <div className={styles.search}>
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un membre..."
            />
          </div>
        </header>

        <div className={styles.filters}>
          {[
            ["ALL", "Tous"],
            ["ACTIVE", "Actifs"],
            ["INACTIVE", "Désactivés"],
          ].map(([value, label]) => (
            <button
              className={`${styles.filterButton} ${
                filter === value ? styles.filterButtonActive : ""
              }`}
              key={value}
              type="button"
              onClick={() =>
                setFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Tâches</th>
                <th>Dernière connexion</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredMembers.map((member) => {
                const initials =
                  `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();
                const avatarClass =
                  [
                    styles.avatar0,
                    styles.avatar1,
                    styles.avatar2,
                    styles.avatar3,
                  ][member.id.charCodeAt(0) % 4];
                const progress = Math.round(
                  (Number(member.assigned_tasks) / maxTasks) * 100,
                );

                return (
                  <tr key={member.id}>
                    <td>
                      <div className={styles.identity}>
                        <span className={`${styles.avatar} ${avatarClass}`}>
                          {initials}
                        </span>
                        <div>
                          <strong>
                            {member.first_name} {member.last_name}
                          </strong>
                          <small>{member.email}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`${styles.role} ${roleClass(member.role)}`}
                      >
                        {roleLabels[member.role] ?? member.role}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`${styles.status} ${
                          member.is_active ? "" : styles.statusInactive
                        }`}
                      >
                        {member.is_active ? "Actif" : "Désactivé"}
                      </span>
                    </td>

                    <td>
                      <div className={styles.tasks}>
                        <strong>{member.assigned_tasks}</strong>
                        <span className={styles.taskBar}>
                          <i style={{ width: `${progress}%` }} />
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className={styles.lastLogin}>
                        <strong>
                          {hydrated
                            ? relativeLastLogin(member.last_login_at)
                            : member.last_login_at
                              ? "Connexion récente"
                              : "Jamais"}
                        </strong>
                        <small>
                          {hydrated && member.last_login_at
                            ? new Date(member.last_login_at).toLocaleString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : member.last_login_at
                              ? "Chargement..."
                              : "Aucune connexion"}
                        </small>
                      </div>
                    </td>

                    <td>
                      {canManage && member.role !== "OWNER" ? (
                        <details className={styles.menu}>
                          <summary aria-label="Actions du membre">
                            <Icon name="more" size={19} />
                          </summary>

                          <div className={styles.menuPanel}>
                            <form action={updateMemberRole}>
                              <input
                                name="userId"
                                type="hidden"
                                value={member.id}
                              />
                              <label>
                                Modifier le rôle
                                <select name="role" defaultValue={member.role}>
                                  <option value="ADMIN">Administrateur</option>
                                  <option value="MANAGER">Manager</option>
                                  <option value="EMPLOYEE">Employé</option>
                                  <option value="VIEWER">Lecture seule</option>
                                </select>
                              </label>
                              <button className={styles.menuButton} type="submit">
                                Enregistrer le rôle
                              </button>
                            </form>

                            <form action={toggleMemberActive}>
                              <input
                                name="userId"
                                type="hidden"
                                value={member.id}
                              />
                              <button
                                className={styles.menuButtonNeutral}
                                type="submit"
                              >
                                {member.is_active
                                  ? "Désactiver le compte"
                                  : "Réactiver le compte"}
                              </button>
                            </form>

                            <form action={removeMember}>
                              <input
                                name="userId"
                                type="hidden"
                                value={member.id}
                              />
                              <button
                                className={styles.menuButtonDanger}
                                type="submit"
                              >
                                Retirer de l’entreprise
                              </button>
                            </form>
                          </div>
                        </details>
                      ) : (
                        <span className={styles.protected}>
                          <Icon name="check" size={15} />
                          Protégé
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredMembers.length === 0 && (
            <div className={styles.empty}>
              <Icon name="users" size={30} />
              <strong>Aucun membre trouvé</strong>
              <span>Modifiez votre recherche ou les filtres.</span>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerCopy}>
            <strong>
              {members.length} membre{members.length > 1 ? "s" : ""} dans
              l’entreprise
            </strong>
            <span>
              Gérez les accès et les responsabilités depuis cet espace.
            </span>
          </div>

          {canManage && (
            <button
              className={styles.footerButton}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setInviteOpen(true);
              }}
            >
              Inviter un membre
              <span>→</span>
            </button>
          )}
        </footer>
      </section>

      {inviteOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setInviteOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="invite-title"
            aria-modal="true"
            className={styles.modal}
            role="dialog"
          >
            <header className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className={styles.modalIcon}>
                  <Icon name="users" size={21} />
                </span>
                <div>
                  <h2 id="invite-title">Inviter un collaborateur</h2>
                  <p>Créez un accès sécurisé à votre entreprise.</p>
                </div>
              </div>

              <button
                aria-label="Fermer"
                className={styles.closeButton}
                type="button"
                onClick={() => setInviteOpen(false)}
              >
                ×
              </button>
            </header>

            <form action={createTeamMember} className={styles.modalForm}>
              <div className={styles.formRow}>
                <label>
                  Prénom
                  <input
                    autoComplete="given-name"
                    name="firstName"
                    placeholder="Enzo"
                    required
                  />
                </label>

                <label>
                  Nom
                  <input
                    autoComplete="family-name"
                    name="lastName"
                    placeholder="Demenois"
                    required
                  />
                </label>
              </div>

              <label>
                Adresse email
                <input
                  autoComplete="email"
                  name="email"
                  placeholder="enzo@entreprise.fr"
                  type="email"
                  required
                />
              </label>

              <label>
                Rôle
                <select defaultValue="EMPLOYEE" name="role">
                  <option value="ADMIN">Administrateur</option>
                  <option value="MANAGER">Manager</option>
                  <option value="EMPLOYEE">Employé</option>
                  <option value="VIEWER">Lecture seule</option>
                </select>
              </label>

              <label>
                Mot de passe temporaire
                <input
                  autoComplete="new-password"
                  minLength={10}
                  name="password"
                  placeholder="10 caractères minimum"
                  type="password"
                  required
                />
              </label>

              <div className={styles.infoBox}>
                <Icon name="settings" size={18} />
                <p>
                  Le collaborateur pourra se connecter immédiatement avec ce
                  mot de passe temporaire.
                </p>
              </div>

              <footer className={styles.modalFooter}>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={() => setInviteOpen(false)}
                >
                  Annuler
                </button>

                <button className={styles.submitButton} type="submit">
                  <Icon name="plus" size={17} />
                  Inviter le membre
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
