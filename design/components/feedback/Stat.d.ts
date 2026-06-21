import * as React from "react";

/**
 * A single headline metric (big thin value + muted label) for the console morning-brief stat grid.
 */
export interface StatProps {
  /** Caption under the value. */
  label: React.ReactNode;
  /** The metric itself. */
  value: React.ReactNode;
  /** Recolor the value when it needs attention. @default "neutral" */
  tone?: "neutral" | "warn";
}

export declare function Stat(props: StatProps): JSX.Element;
