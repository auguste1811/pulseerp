"use client";

import { useEffect } from "react";

const TEN_MINUTES = 10 * 60 * 1000;

export function GmailAutoSync() {
  useEffect(() => {
    let stopped = false;

    const sync = async () => {
      try {
        await fetch("/api/integrations/google/gmail-sync", {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        // A failed background sync must never block PulseERP.
      }
    };

    void sync();
    const timer = window.setInterval(() => {
      if (!stopped && document.visibilityState === "visible") void sync();
    }, TEN_MINUTES);

    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
