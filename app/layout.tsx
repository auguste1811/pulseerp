import "./globals.css";

export const metadata = {
  title: "PulseERP — Pilotez toute votre entreprise",
  description:
    "CRM, facturation, tâches, documents, rapports et automatisations réunis dans une plateforme de gestion moderne.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
