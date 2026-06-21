import * as React from "react";

/**
 * The frosted-glass surface that floats over the studio ground. The default container for grouped
 * content across marketing and console.
 *
 * @startingPoint section="Core" subtitle="Frosted-glass surface" viewport="700x200"
 */
export interface CardProps {
  /** Element/tag to render. @default "div" */
  as?: "div" | "article" | "li" | "section";
  /** Padding + radius scale. @default "md" */
  size?: "sm" | "md";
  /** Add the hover-lift used on clickable cards. @default false */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export declare function Card(props: CardProps): JSX.Element;
