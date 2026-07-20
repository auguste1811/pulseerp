import type { ReactNode } from "react";
export function StatCard({label,value,caption,icon,tone="purple"}:{label:string;value:string;caption:string;icon:ReactNode;tone?:"purple"|"blue"|"green"|"orange"}){return <article className="pe-stat-card"><span className={`pe-stat-icon pe-stat-${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{caption}</em></div></article>}
