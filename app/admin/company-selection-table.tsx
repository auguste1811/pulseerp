"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteSelectedCompanies } from "./actions";

type CompanyRow = {
  id: string;
  name: string;
  email: string | null;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  moduleCount: number;
  accessExpiresAt: string | null;
  status: string;
  expired: boolean;
  protected: boolean;
};

export function CompanySelectionTable({
  companies,
}: {
  companies: CompanyRow[];
}) {
  const selectableIds = useMemo(
    () => companies.filter((company) => !company.protected).map((company) => company.id),
    [companies],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState("");

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={deleteSelectedCompanies}>
      <div className="platform-admin-table-toolbar">
        <div>
          <strong>{selected.size} entreprise(s) sélectionnée(s)</strong>
          <small>
            Les entreprises auxquelles votre compte développeur appartient sont protégées.
          </small>
        </div>

        <div className="bulk-delete-controls">
          <input
            name="bulkConfirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder='Tapez DELETE'
            aria-label="Confirmation de suppression multiple"
          />
          <button
            className="danger-action"
            type="submit"
            disabled={selected.size === 0 || confirmation !== "DELETE"}
          >
            Supprimer la sélection
          </button>
        </div>
      </div>

      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="companyIds" value={id} />
      ))}

      <div className="platform-admin-table-wrap">
        <table className="platform-admin-table">
          <thead>
            <tr>
              <th className="selection-cell">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Sélectionner toutes les entreprises"
                  disabled={selectableIds.length === 0}
                />
              </th>
              <th>Entreprise</th>
              <th>Responsable</th>
              <th>Utilisateurs</th>
              <th>Modules</th>
              <th>Expiration</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td className="selection-cell">
                  <input
                    type="checkbox"
                    checked={selected.has(company.id)}
                    onChange={() => toggleOne(company.id)}
                    aria-label={`Sélectionner ${company.name}`}
                    disabled={company.protected}
                    title={
                      company.protected
                        ? "Cette entreprise est protégée car votre compte y est rattaché."
                        : undefined
                    }
                  />
                </td>
                <td>
                  <strong>{company.name}</strong>
                  <small>{company.email || "Aucun email société"}</small>
                  {company.protected && (
                    <em className="protected-company-label">Protégée</em>
                  )}
                </td>
                <td>
                  {company.ownerName}
                  <small>{company.ownerEmail}</small>
                </td>
                <td>{company.memberCount}</td>
                <td>
                  <span className="module-count-badge">
                    {company.moduleCount} actif(s)
                  </span>
                </td>
                <td>
                  {company.accessExpiresAt
                    ? new Date(company.accessExpiresAt).toLocaleDateString("fr-FR")
                    : "Illimité"}
                </td>
                <td>
                  <span
                    className={`company-status-badge ${
                      company.status === "ACTIVE" && !company.expired
                        ? "active"
                        : "suspended"
                    }`}
                  >
                    {company.expired
                      ? "Expirée"
                      : company.status === "ACTIVE"
                        ? "Active"
                        : "Suspendue"}
                  </span>
                </td>
                <td>
                  <Link href={`/admin/companies/${company.id}`}>Gérer →</Link>
                </td>
              </tr>
            ))}

            {companies.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    Aucune entreprise enregistrée.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
