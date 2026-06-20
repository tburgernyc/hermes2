import type { JSX, ReactNode } from "react";

import styles from "./Alert.module.css";

interface AlertProps {
  variant?: "error" | "success" | "info";
  role?: "alert" | "status";
  testId?: string;
  children: ReactNode;
}

/**
 * Inline status/error message. Defaults to role="alert" (errors); pass role="status" for a non-interrupting
 * success/info. Colors are WCAG AA on their tinted backgrounds.
 */
export function Alert({ variant = "error", role = "alert", testId, children }: AlertProps): JSX.Element {
  return (
    <p role={role} data-testid={testId} className={`${styles.alert} ${styles[variant]}`}>
      {children}
    </p>
  );
}
