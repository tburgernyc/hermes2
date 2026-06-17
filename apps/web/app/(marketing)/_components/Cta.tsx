import Link from "next/link";
import type { JSX, ReactNode } from "react";

import styles from "./Cta.module.css";

interface CtaProps {
  href: string;
  variant?: "primary" | "secondary";
  block?: boolean;
  children: ReactNode;
}

/** A link styled as a call-to-action button. Always a real anchor (next/link) — keyboard + SR friendly. */
export function Cta({ href, variant = "primary", block = false, children }: CtaProps): JSX.Element {
  const className = [styles.cta, styles[variant], block ? styles.block : ""].filter(Boolean).join(" ");
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
