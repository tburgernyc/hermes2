import * as React from "react";

/**
 * A labeled text input — the standard form control. The label wraps the input for implicit
 * association; native input attributes pass through.
 */
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visible field label. */
  label: React.ReactNode;
  /** Optional helper text below the input. */
  hint?: React.ReactNode;
}

export declare function Field(props: FieldProps): JSX.Element;
