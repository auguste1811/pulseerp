"use client";
type Point={label:string;income:number;expenses:number};
export function FinancialChart({points,height=280}:{points:Point[];height?:number}){
 const width=900,padL=72,padR=24,padT=24,padB=48,plotW=width-padL-padR,plotH=height-padT-padB;
 const max=Math.max(1,...points.flatMap(p=>[p.income,p.expenses])); const x=(i:number)=>padL+(points.length<=1?0:(i/(points.length-1))*plotW); const y=(v:number)=>padT+plotH-(v/max)*plotH;
 const line=(key:"income"|"expenses")=>points.map((p,i)=>`${i===0?"M":"L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
 const area=points.length?`${line("income")} L${x(points.length-1)},${padT+plotH} L${x(0)},${padT+plotH} Z`:"";
 const ticks=[0,.25,.5,.75,1];
 return <div className="financial-chart"><div className="financial-chart-legend"><span><i className="income"/>Chiffre d’affaires</span><span><i className="expense"/>Dépenses</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution du chiffre d’affaires et des dépenses">
  <defs><linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6653e8" stopOpacity=".25"/><stop offset="100%" stopColor="#6653e8" stopOpacity="0"/></linearGradient></defs>
  {ticks.map(t=>{const yy=padT+plotH-t*plotH;return <g key={t}><line x1={padL} y1={yy} x2={width-padR} y2={yy} className="financial-grid"/><text x={padL-12} y={yy+4} textAnchor="end" className="financial-axis">{Math.round(max*t).toLocaleString("fr-FR")} €</text></g>})}
  {area&&<path d={area} fill="url(#incomeArea)"/>}<path d={line("income")} className="financial-line income"/><path d={line("expenses")} className="financial-line expense"/>
  {points.map((p,i)=><g key={`${p.label}-${i}`}><line x1={x(i)} y1={padT} x2={x(i)} y2={padT+plotH} className="financial-hover-line"/><circle cx={x(i)} cy={y(p.income)} r="4.5" className="financial-point income"><title>{p.label} — CA : {p.income.toLocaleString("fr-FR")} €</title></circle><circle cx={x(i)} cy={y(p.expenses)} r="4" className="financial-point expense"><title>{p.label} — Dépenses : {p.expenses.toLocaleString("fr-FR")} €</title></circle><text x={x(i)} y={height-17} textAnchor="middle" className="financial-axis">{p.label}</text></g>)}
 </svg></div>;
}
