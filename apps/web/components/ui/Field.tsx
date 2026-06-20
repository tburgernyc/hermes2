import type { InputHTMLAttributes, JSX, ReactNode } from "react";

import styles from "./Field.module.css";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
}

/**
 * A labeled text input. The <label> wraps the <input> (implicit association); native input attributes
 * (name, type, value, readOnly, minLength, inputMode, …) pass straight through, preserving form wiring
 * and e2e input selectors. `name` is optional so a display-only field (e.g. a read-only email that the
 * server reads from a trusted record, never the form) can omit it. Presentational (server-component safe).
 */
export function Field({ label, hint, className, ...rest }: FieldProps): JSX.Element {
  const inputCls = [styles.input, className].filter(Boolean).join(" ");
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={inputCls} {...rest} />
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
