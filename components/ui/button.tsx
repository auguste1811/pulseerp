import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "secondary" | "ghost"; href?: string };
export function Button({ children, variant="primary", href, className="", ...props }: Props) {
  const classes = `pe-button pe-button-${variant} ${className}`.trim();
  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
