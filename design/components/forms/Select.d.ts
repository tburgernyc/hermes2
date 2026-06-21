import * as React from "react";

/**
 * A labeled select control that mirrors Field's layout. Native select attributes pass through.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Visible field label. */
  label: React.ReactNode;
  children: React.ReactNode;
}

export declare function Select(props: SelectProps): JSX.Element;
