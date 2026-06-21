"use client";

import { useRef, useState, type JSX, type KeyboardEvent } from "react";

import styles from "./TotpInput.module.css";

interface TotpInputProps {
  /** Number of code cells. */
  length?: number;
  /** Hidden field name submitted with the form (the server action reads this). */
  name?: string;
  /** Optional label rendered above the cells. */
  label?: string;
}

/**
 * Six-cell one-time-passcode entry (ported from the console UI kit). Each cell holds one digit and
 * auto-advances focus; Backspace on an empty cell steps back. The combined value is mirrored into a
 * hidden input so the existing server action reads the same `code` field unchanged. There is NO
 * auto-submit — the form's Verify/Confirm button submits — which keeps the admin step-up deterministic
 * for the documented cold-start retry path.
 */
export function TotpInput({ length = 6, name = "code", label }: TotpInputProps): JSX.Element {
  const [values, setValues] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(index: number, raw: string): void {
    if (!/^[0-9]?$/.test(raw)) return;
    setValues((current) => {
      const next = current.slice();
      next[index] = raw.slice(-1);
      return next;
    });
    if (raw && index < length - 1) refs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Backspace" && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.row}>
        {values.map((value, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            className={styles.cell}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={value}
            onChange={(e) => setAt(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            aria-label={`Digit ${index + 1}`}
            data-testid={`totp-cell-${index}`}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={values.join("")} readOnly />
    </div>
  );
}
