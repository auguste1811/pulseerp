"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#f7f8fc",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <section
            style={{
              width: "min(100%, 560px)",
              padding: 36,
              border: "1px solid #e1e4ed",
              borderRadius: 20,
              background: "#fff",
              textAlign: "center",
            }}
          >
            <h1>PulseERP rencontre une erreur temporaire</h1>
            <p>Rechargez l’application pour reprendre votre travail.</p>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 42,
                padding: "0 18px",
                border: 0,
                borderRadius: 10,
                color: "#fff",
                background: "#6653e8",
                cursor: "pointer",
              }}
            >
              Recharger
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
