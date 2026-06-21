import * as React from "react";

/**
 * A visible "not yet final" marker. Per the firm's truthfulness contract, anything not yet real
 * (CAGE code, unpublished contact details, draft capability statement) renders as an obvious
 * placeholder rather than a fabricated value.
 */
export interface PlaceholderBadgeProps {
  /** Label text. @default "Pending" */
  children?: React.ReactNode;
}

export declare function PlaceholderBadge(props: PlaceholderBadgeProps): JSX.Element;
