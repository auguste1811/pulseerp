import type { ReactNode } from "react";
export function Badge({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"success"|"warning"|"danger"|"purple"}){return <span className={`pe-badge pe-badge-${tone}`}>{children}</span>}
