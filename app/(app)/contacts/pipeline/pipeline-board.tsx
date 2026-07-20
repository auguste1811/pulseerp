"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveContactStage } from "../actions";
import { Icon } from "../../components/icons";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  status: string;
  value: string | number;
  priority: string;
  tags: string[];
};

const columns = [
  { value: "PROSPECT", label: "Prospects" },
  { value: "CONTACTED", label: "Contactés" },
  { value: "MEETING", label: "Rendez-vous" },
  { value: "NEGOTIATION", label: "Négociation" },
  { value: "CUSTOMER", label: "Clients" },
  { value: "LOST", label: "Perdus" },
];

export function PipelineBoard({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function dropInto(status: string) {
    if (!draggedId) return;
    const previous = contacts;
    setContacts((items) =>
      items.map((item) => (item.id === draggedId ? { ...item, status } : item)),
    );

    startTransition(async () => {
      try {
        await moveContactStage(draggedId, status);
      } catch {
        setContacts(previous);
      } finally {
        setDraggedId(null);
      }
    });
  }

  return (
    <div className={`crm-pipeline ${isPending ? "is-saving" : ""}`}>
      {columns.map((column) => {
        const items = contacts.filter((contact) => contact.status === column.value);
        const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

        return (
          <section
            className="pipeline-column"
            key={column.value}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropInto(column.value)}
          >
            <header className="pipeline-column-header">
              <div>
                <i className={`pipeline-status-dot ${column.value.toLowerCase()}`} />
                <strong>{column.label}</strong>
                <span>{items.length}</span>
              </div>
              <small>{total.toLocaleString("fr-FR")} €</small>
            </header>

            <div className="pipeline-cards">
              {items.map((contact) => (
                <article
                  className="pipeline-card"
                  draggable
                  key={contact.id}
                  onDragStart={() => setDraggedId(contact.id)}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <div className="pipeline-card-top">
                    <span className={`priority-badge ${contact.priority.toLowerCase()}`}>
                      {contact.priority}
                    </span>
                    <Icon name="more" size={17} />
                  </div>
                  <Link href={`/contacts/${contact.id}`}>
                    <h3>{contact.first_name} {contact.last_name}</h3>
                    <p>{contact.company_name || contact.email || "Sans entreprise"}</p>
                    <strong className="pipeline-value">
                      {Number(contact.value || 0).toLocaleString("fr-FR")} €
                    </strong>
                    {contact.tags?.length > 0 && (
                      <div className="pipeline-tags">
                        {contact.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    )}
                  </Link>
                </article>
              ))}

              {items.length === 0 && (
                <div className="pipeline-empty">Déposez un contact ici</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
