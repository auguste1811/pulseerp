"use client";

import { useState } from "react";
import styles from "./pulse-ai.module.css";

type Message = { role: "user" | "assistant"; content: string };

export function PulseAIClient({
  initialConversationId,
  initialMessages,
  configured,
  initialUsage,
}: {
  initialConversationId?: string;
  initialMessages: Message[];
  configured: boolean;
  initialUsage: { usedToday: number; dailyLimit: number };
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(initialUsage);

  const suggestions = [
    "Analyse mon chiffre d’affaires et mes dépenses.",
    "Quelles factures nécessitent une relance ?",
    "Quels sont mes prospects les plus importants ?",
    "Résume mes priorités de la semaine.",
  ];

  async function send(value = message) {
    const clean = value.trim();
    if (!clean || loading || !configured) return;
    setError("");
    setMessage("");
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur PulseAI");
      setConversationId(data.conversationId);
      if (data.usage) {
        setUsage({ usedToday: data.usage.usedToday, dailyLimit: data.usage.dailyLimit });
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.answer },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur PulseAI");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.chat}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <span className={styles.orb}>AI</span>
            <h2>Que souhaitez-vous analyser ?</h2>
            <p>
              PulseAI utilise les données de votre entreprise pour vous aider à
              piloter votre activité.
            </p>
            <div className={styles.suggestions}>
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => send(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((item, index) => (
              <article className={styles[item.role]} key={`${item.role}-${index}`}>
                <span>{item.role === "assistant" ? "PulseAI" : "Vous"}</span>
                <p>{item.content}</p>
              </article>
            ))}
            {loading && (
              <article className={styles.assistant}>
                <span>PulseAI</span><p>Analyse en cours…</p>
              </article>
            )}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.composer}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Demandez une analyse, un résumé ou une recommandation…"
            rows={3}
          />
          <button type="button" disabled={!configured || loading || !message.trim()} onClick={() => send()}>
            Envoyer
          </button>
        </div>
      </section>

      <aside className={styles.info}>
        <h3>PulseAI avec Gemini</h3>
        <div><strong>Quota du jour</strong><span>{usage.usedToday} / {usage.dailyLimit} demandes utilisées.</span></div>
        <div><strong>Finance</strong><span>Analyser le CA, les dépenses et la TVA.</span></div>
        <div><strong>CRM</strong><span>Identifier les prospects et clients prioritaires.</span></div>
        <div><strong>Facturation</strong><span>Repérer les factures en retard et préparer les relances.</span></div>
        <div><strong>Organisation</strong><span>Résumer les tâches et les échéances importantes.</span></div>
        <p className={styles.privacy}>
          Les données utiles à votre demande sont transmises à l’API Gemini configurée pour PulseERP.
        </p>
      </aside>
    </div>
  );
}
