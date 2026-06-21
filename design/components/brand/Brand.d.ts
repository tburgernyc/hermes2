/**
 * The BurgerGov monogram + wordmark lockup. Use in app chrome — auth cards, nav bars, public token
 * pages. The mark is a navy rounded-square "B" monogram; the wordmark is real text.
 */
export interface BrandProps {
  /** Lockup scale. @default "md" */
  size?: "sm" | "md" | "lg";
}

export declare function Brand(props: BrandProps): JSX.Element;
