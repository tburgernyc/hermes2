import * as React from "react";

/**
 * Inline status / error banner. Use for form validation and server-action results.
 */
export interface AlertProps {
  /** Visual + semantic variant. @default "error" */
  variant?: "error" | "success" | "info";
  /** ARIA live role. @default "alert" */
  role?: "alert" | "status";
  children: React.ReactNode;
}

export declare function Alert(props: AlertProps): JSX.Element;
