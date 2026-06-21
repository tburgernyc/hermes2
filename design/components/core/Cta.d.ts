import * as React from "react";

/**
 * A call-to-action link styled as a pill button. Renders a real anchor — use on marketing pages
 * for navigation actions ("Partner with us", "View capability statement").
 */
export interface CtaProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Destination URL. */
  href: string;
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary";
  /** Stretch to full width. @default false */
  block?: boolean;
  children: React.ReactNode;
}

export declare function Cta(props: CtaProps): JSX.Element;
