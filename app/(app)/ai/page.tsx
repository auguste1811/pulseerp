import Link from "next/link";
import { currentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PulseAIClient } from "./pulse-ai-client";
import styles from "./pulse-ai.module.css";

export default async function PulseAIPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const member = await currentContext();
  const { conversation } = await searchParams;

  const conversations = await prisma.aiConversation.findMany({
    where: { companyId: member.company_id },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, updatedAt: true },
  });

  const selected = conversation
    ? await prisma.aiConversation.findFirst({
        where: { id: conversation, companyId: member.company_id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 30 } },
      })
    : null;

  return (
    <div className={styles.page}>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Intelligence d’entreprise</p>
          <h1>PulseAI</h1>
          <p>Interrogez vos données CRM, financières et opérationnelles.</p>
        </div>
        <Link className="primary-action" href="/ai">Nouvelle conversation</Link>
      </section>

      {conversations.length > 0 && (
        <nav className={styles.history}>
          {conversations.map((item: any) => (
            <Link
              className={item.id === selected?.id ? styles.active : ""}
              href={`/ai?conversation=${item.id}`}
              key={item.id}
            >
              <strong>{item.title}</strong>
              <small>{item.updatedAt.toLocaleDateString("fr-FR")}</small>
            </Link>
          ))}
        </nav>
      )}

      <PulseAIClient
        initialConversationId={selected?.id}
        initialMessages={(selected?.messages || []).map((item: any) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        }))}
      />
    </div>
  );
}
