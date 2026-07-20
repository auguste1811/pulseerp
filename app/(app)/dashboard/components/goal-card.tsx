export function GoalCard({
  revenue,
  target,
}: {
  revenue: number;
  target: number;
}) {
  const progress = Math.min(100, target ? (revenue / target) * 100 : 0);
  const remaining = Math.max(0, target - revenue);

  return (
    <article className="dashboard-panel goal-panel">
      <div className="panel-header">
        <div>
          <h2>Objectif mensuel</h2>
          <p>Progression du chiffre d’affaires</p>
        </div>
      </div>

      <div
        className="goal-ring"
        style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}
      >
        <div>
          <strong>{progress.toFixed(0)} %</strong>
          <span>atteint</span>
        </div>
      </div>

      <div className="goal-summary">
        <div><span>Réalisé</span><strong>{revenue.toLocaleString("fr-FR")} €</strong></div>
        <div><span>Objectif</span><strong>{target.toLocaleString("fr-FR")} €</strong></div>
      </div>
      <p className="goal-message">
        Encore <strong>{remaining.toLocaleString("fr-FR")} €</strong> pour atteindre l’objectif.
      </p>
    </article>
  );
}
