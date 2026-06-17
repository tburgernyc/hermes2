import type { JSX, ReactNode } from "react";

import styles from "./PlaceholderBadge.module.css";

/**
 * A visible "not yet final" marker. The truthfulness contract (CLAUDE.md) requires every not-yet-real
 * item — CAGE code, capability-statement PDF, headshot, direct contact details — to render as an obvious
 * placeholder, never as a finished claim. The leading dot + label make the pending state unmistakable.
 */
export function PlaceholderBadge({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <span className={styles.badge}>
      <span className={styles.dot} aria-hidden="true" />
      {children ?? "Pending"}
    </span>
  );
}
