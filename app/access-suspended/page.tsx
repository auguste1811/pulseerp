import { signOut } from "@/auth";

export default function AccessSuspendedPage() {
  return (
    <main className="access-state-page">
      <section className="access-state-card">
        <span className="access-state-icon">⏸</span>
        <p className="eyebrow">Accès suspendu</p>
        <h1>L’espace de votre entreprise est temporairement indisponible</h1>
        <p>
          Les données sont conservées. Contactez l’administrateur de PulseERP
          pour réactiver l’entreprise ou prolonger sa date d’accès.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="secondary-action" type="submit">
            Se déconnecter
          </button>
        </form>
      </section>
    </main>
  );
}
