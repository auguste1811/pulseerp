import type { ReactNode } from "react";
export function Card({children,className=""}:{children:ReactNode;className?:string}){return <section className={`pe-card ${className}`}>{children}</section>}
export function CardHeader({title,description,action}:{title:string;description?:string;action?:ReactNode}){return <header className="pe-card-header"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>}
