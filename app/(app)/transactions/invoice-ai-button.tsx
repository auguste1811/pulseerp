"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvoiceAIButton({
  id,
  status,
}: {
  id: string;
  status?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const ready = status === "READY";
  const processing = status === "PROCESSING";

  async function analyze() {
    if (ready) {
      router.push(`/transactions/ocr/${id}`);
      return;
    }

    setState("loading");

    try {
      const response = await fetch(
        `/api/ai/purchase-invoices/${id}/analyze`,
        { method: "POST" },
      );

      const data = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Analyse impossible");
      }

      router.push(data.redirectTo || `/transactions/ocr/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setState("error");
    }
  }

  return (
    <button
      className="icon-link"
      type="button"
      onClick={analyze}
      disabled={state === "loading" || processing}
      title={
        state === "error"
          ? "Une erreur est survenue. Cliquez pour réessayer."
          : undefined
      }
    >
      {processing
        ? "OCR en cours…"
        : state === "loading"
          ? "Analyse…"
          : state === "error"
            ? "Réessayer OCR"
            : ready
              ? "Vérifier OCR"
              : "Analyser OCR"}
    </button>
  );
}
