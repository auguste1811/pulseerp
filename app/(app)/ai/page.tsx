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

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const dailyLimit = Math.max(1, Number.parseInt(process.env.GEMINI_DAILY_LIMIT || "50", 10) || 50);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [conversations, usedToday] = await Promise.all([
    prisma.aiConversation.findMany({
    where: { companyId: member.company_id },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, updatedAt: true },
    }),
    prisma.aiMessage.count({
      where: {
        role: "user",
        createdAt: { gte: today },
        conversation: { companyId: member.company_id },
      },
    }),
  ]);

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

      {!geminiConfigured && (
        <div className="import-alert error">
          <strong>Gemini n’est pas configuré.</strong>
          <span>Ajoutez GEMINI_API_KEY dans Vercel puis redéployez.</span>
        </div>
      )}

      <PulseAIClient
        initialConversationId={selected?.id}
        configured={geminiConfigured}
        initialUsage={{ usedToday, dailyLimit }}
        initialMessages={(selected?.messages || []).map((item: any) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        }))}
      />
    </div>
  );
}
