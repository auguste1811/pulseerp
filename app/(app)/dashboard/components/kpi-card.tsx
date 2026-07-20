import { Icon, type IconName } from "../../components/icons";

export function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  icon,
  tone,
}: {
  label: string;
  value: string;
  trend: number;
  trendLabel: string;
  icon: IconName;
  tone: "purple" | "green" | "orange" | "blue";
}) {
  const positive = trend >= 0;

  return (
    <article className="kpi-card">
      <div className={`kpi-icon ${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      <div className="kpi-heading">
        <span>{label}</span>
        <button aria-label={`Options ${label}`} type="button">
          <Icon name="more" size={18} />
        </button>
      </div>
      <strong>{value}</strong>
      <div className={`kpi-trend ${positive ? "positive" : "negative"}`}>
        <span>
          <Icon name={positive ? "arrowUp" : "arrowDown"} size={14} />
          {Math.abs(trend).toFixed(1)} %
        </span>
        <small>{trendLabel}</small>
      </div>
    </article>
  );
}
