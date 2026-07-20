"use client";

import { useState } from "react";

export function SyncButton({
  provider,
}: {
  provider: "google" | "microsoft";
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function sync() {
    setStatus("loading");
    try {
      const response = await fetch(`/api/integrations/${provider}/sync`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      setStatus("success");
      window.location.reload();
    } catch {
      setStatus("error");
    }
  }

  return (
    <button type="button" onClick={sync} disabled={status === "loading"}>
      {status === "loading"
        ? "Synchronisation..."
        : status === "success"
          ? "Synchronisé"
          : status === "error"
            ? "Réessayer"
            : "Synchroniser"}
    </button>
  );
}
