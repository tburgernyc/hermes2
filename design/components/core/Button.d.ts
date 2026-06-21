import * as React from "react";

/**
 * The BurgerGov button. Pill-shaped, studio palette. Primary is a gradient-navy fill; secondary
 * a frosted-glass surface; ghost a quiet outline; danger a solid destructive fill.
 *
 * @startingPoint section="Core" subtitle="Pill button — 4 variants, 2 sizes" viewport="700x140"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Control height. @default "md" */
  size?: "sm" | "md";
  /** Stretch to fill the container width. @default false */
  block?: boolean;
}

export declare function Button(props: ButtonProps): JSX.Element;
