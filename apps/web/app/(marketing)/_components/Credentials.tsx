import type { JSX } from "react";

import { CREDENTIALS } from "@/lib/site";

import { PlaceholderBadge } from "./PlaceholderBadge";
import styles from "./marketing.module.css";

/**
 * Credentials & registrations — rendered straight from site.ts. "confirmed" values show plainly;
 * "assigned"/"pending" carry a visible badge so a not-yet-final item is never mistaken for a finished
 * claim (truthfulness contract). The CAGE code is "pending" and shows a placeholder, never a fake value.
 */
export function Credentials(): JSX.Element {
  return (
    <ul className={styles.credentials}>
      {CREDENTIALS.map((c) => (
        <li key={c.label} className={styles.cred}>
          <span className={styles.credLabel}>{c.label}</span>
          <span className={styles.credValue}>
            {c.value}
            {c.state === "pending" ? <PlaceholderBadge>Pending</PlaceholderBadge> : null}
            {c.state === "assigned" ? <PlaceholderBadge>On request</PlaceholderBadge> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
