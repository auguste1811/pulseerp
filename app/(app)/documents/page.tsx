import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { query } from "@/lib/db";
import { Icon } from "../components/icons";
import { deleteDocument, uploadDocument } from "./actions";

const categoryLabels: Record<string, string> = {
  INVOICE: "Facture",
  QUOTE: "Devis",
  CONTRACT: "Contrat",
  HR: "Ressources humaines",
  IDENTITY: "Identité",
  BANK: "Banque",
  MARKETING: "Marketing",
  OTHER: "Autre",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    uploaded?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const member = await currentContext();
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const category = (params.category ?? "").trim();

  const [documents, contacts, counts] = await Promise.all([
    query<any>(
      `
      SELECT d.*, c.first_name, c.last_name, c.company_name,
             u.first_name AS uploader_first_name,
             u.last_name AS uploader_last_name
      FROM documents d
      LEFT JOIN contacts c ON c.id=d.contact_id
      LEFT JOIN users u ON u.id=d.uploaded_by
      WHERE d.company_id=$1
        AND ($2='' OR d.name ILIKE '%' || $2 || '%'
             OR d.original_name ILIKE '%' || $2 || '%'
             OR d.notes ILIKE '%' || $2 || '%')
        AND ($3='' OR d.category=$3)
      ORDER BY d.created_at DESC
      `,
      [member.company_id, search, category],
    ),
    query<any>(
      `
      SELECT id, first_name, last_name, company_name
      FROM contacts
      WHERE company_id=$1
      ORDER BY last_name, first_name
      `,
      [member.company_id],
    ),
    query<any>(
      `
      SELECT category, COUNT(*)::int AS count
      FROM documents
      WHERE company_id=$1
      GROUP BY category
      `,
      [member.company_id],
    ),
  ]);

  const totalSize = documents.reduce(
    (sum, document) => sum + Number(document.size_bytes),
    0,
  );

  const errors: Record<string, string> = {
    invalid: "Vérifiez les informations et sélectionnez un fichier.",
    size: "Le fichier doit faire moins de 15 Mo.",
    format: "Ce format de fichier n’est pas autorisé.",
    contact: "Le contact sélectionné est invalide.",
    database: "Le fichier n’a pas pu être enregistré.",
  };

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Gestion documentaire</p>
          <h1>Documents</h1>
          <p>Centralisez les contrats, factures et fichiers de votre entreprise.</p>
        </div>
      </section>

      {(params.uploaded || params.deleted) && (
        <div className="import-alert success">
          <strong>Opération terminée.</strong>
          <span>
            {params.uploaded
              ? "Le document a été ajouté."
              : "Le document a été supprimé."}
          </span>
        </div>
      )}

      {params.error && (
        <div className="import-alert error">
          <strong>Opération impossible.</strong>
          <span>{errors[params.error] ?? "Vérifiez le document."}</span>
        </div>
      )}

      <section className="documents-stats">
        <div><span>Documents</span><strong>{documents.length}</strong></div>
        <div><span>Espace utilisé</span><strong>{formatSize(totalSize)}</strong></div>
        <div><span>Contrats</span><strong>{counts.find((item) => item.category === "CONTRACT")?.count ?? 0}</strong></div>
        <div><span>Factures</span><strong>{counts.find((item) => item.category === "INVOICE")?.count ?? 0}</strong></div>
      </section>

      <section className="documents-layout">
        <aside className="dashboard-panel documents-upload-card">
          <div className="panel-header">
            <div>
              <h2>Ajouter un fichier</h2>
              <p>PDF, images, Word, Excel et CSV.</p>
            </div>
          </div>

          <form action={uploadDocument} className="premium-form">
            <label>Nom du document
              <input name="name" placeholder="Contrat Agence Nova" required />
            </label>

            <label>Catégorie
              <select name="category" defaultValue="OTHER">
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>Contact CRM
              <select name="contactId">
                <option value="">Aucun contact</option>
                {contacts.map((contact) => (
                  <option value={contact.id} key={contact.id}>
                    {contact.first_name} {contact.last_name}
                    {contact.company_name ? ` — ${contact.company_name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="document-dropzone">
              <input
                name="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,.txt"
                required
              />
              <Icon name="documents" size={28} />
              <strong>Sélectionner un fichier</strong>
              <small>15 Mo maximum</small>
            </label>

            <label>Notes
              <textarea name="notes" placeholder="Informations complémentaires..." />
            </label>

            <button className="primary-action full-width" type="submit">
              Envoyer le document
            </button>
          </form>
        </aside>

        <div className="documents-main">
          <article className="dashboard-panel">
            <form className="documents-toolbar">
              <div>
                <Icon name="search" size={17} />
                <input
                  name="q"
                  defaultValue={search}
                  placeholder="Rechercher un document..."
                />
              </div>
              <select name="category" defaultValue={category}>
                <option value="">Toutes les catégories</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
              <button className="secondary-action" type="submit">Filtrer</button>
            </form>
          </article>

          <article className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>Bibliothèque</h2>
                <p>{documents.length} résultat{documents.length > 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="document-list">
              {documents.map((document) => (
                <div className="document-row" key={document.id}>
                  <span className={`document-file-icon ${document.category.toLowerCase()}`}>
                    {document.original_name.split(".").pop()?.slice(0,4).toUpperCase()}
                  </span>

                  <div className="document-main">
                    <strong>{document.name}</strong>
                    <small>
                      {document.original_name} · {formatSize(Number(document.size_bytes))}
                    </small>
                  </div>

                  <span className="document-category">
                    {categoryLabels[document.category] ?? document.category}
                  </span>

                  <div className="document-contact">
                    <span>Contact</span>
                    <strong>
                      {document.company_name ||
                        (document.first_name
                          ? `${document.first_name} ${document.last_name}`
                          : "Aucun")}
                    </strong>
                  </div>

                  <div className="document-date">
                    <span>Ajouté le</span>
                    <strong>
                      {new Date(document.created_at).toLocaleDateString("fr-FR")}
                    </strong>
                  </div>

                  <div className="document-actions">
                    <Link
                      className="secondary-action"
                      href={`/api/documents/${document.id}`}
                    >
                      Télécharger
                    </Link>
                    <form action={deleteDocument}>
                      <input type="hidden" name="documentId" value={document.id} />
                      <button className="document-delete" type="submit">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </div>
              ))}

              {documents.length === 0 && (
                <div className="empty-state">
                  Aucun document ne correspond à la recherche.
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
