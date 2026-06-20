import type { ButtonHTMLAttributes, JSX } from "react";

import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

/**
 * Shared button. Presentational (no client hooks) so it renders inside server components; `type` and the
 * other native button attributes pass straight through. Variants reuse the studio palette (primary =
 * gradient-navy pill); keyboard focus uses the global :focus-visible ring.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  ...rest
}: ButtonProps): JSX.Element {
  const cls = [styles.button, styles[variant], styles[size], block ? styles.block : "", className]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...rest} />;
}
