import * as React from "react";

/**
 * A small tracked mono-caps status badge. Tone carries the meaning — used everywhere data state
 * is shown (solicitation status, quote status, pending markers).
 */
export interface BadgeProps {
  /** Semantic tone. @default "neutral" */
  tone?: "neutral" | "info" | "success" | "warn" | "danger";
  children: React.ReactNode;
}

export declare function Badge(props: BadgeProps): JSX.Element;
