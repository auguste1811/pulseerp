const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil"];
const revenue = [34, 47, 43, 60, 67, 77, 92];
const expenses = [18, 25, 28, 34, 38, 46, 52];

export function RevenueChart() {
  return (
    <article className="dashboard-panel chart-panel">
      <div className="panel-header">
        <div>
          <h2>Performance financière</h2>
          <p>Évolution du chiffre d’affaires et des dépenses</p>
        </div>
        <select aria-label="Période du graphique" defaultValue="7m">
          <option value="7m">7 derniers mois</option>
          <option value="30d">30 derniers jours</option>
          <option value="1y">Cette année</option>
        </select>
      </div>

      <div className="chart-legend">
        <span><i className="legend-revenue" /> Chiffre d’affaires</span>
        <span><i className="legend-expenses" /> Dépenses</span>
      </div>

      <div className="bar-chart">
        {[0, 25, 50, 75, 100].reverse().map((tick) => (
          <span className="chart-gridline" style={{ bottom: `${tick}%` }} key={tick}>
            <small>{tick}k</small>
          </span>
        ))}
        {months.map((month, index) => (
          <div className="chart-column" key={month}>
            <div className="bars">
              <span
                className="bar revenue-bar"
                style={{ height: `${revenue[index]}%` }}
                title={`CA ${month}`}
              />
              <span
                className="bar expense-bar"
                style={{ height: `${expenses[index]}%` }}
                title={`Dépenses ${month}`}
              />
            </div>
            <small>{month}</small>
          </div>
        ))}
      </div>
    </article>
  );
}
