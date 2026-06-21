import React from "react";

const VARIANTS = {
  error: { bg: "var(--tone-danger-surface)", bd: "var(--tone-danger-border)", fg: "var(--tone-danger-ink)" },
  success: { bg: "var(--tone-success-surface)", bd: "var(--tone-success-border)", fg: "var(--tone-success-ink)" },
  info: { bg: "var(--tone-info-surface)", bd: "var(--tone-info-border)", fg: "var(--tone-info-ink)" },
};

/**
 * Inline status / error message. Defaults to role="alert" (errors); pass role="status" for a
 * non-interrupting success or info message. Colors are AA on their tinted surfaces.
 */
export function Alert({ variant = "error", role = "alert", children, style, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.error;
  return (
    <p
      role={role}
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius)",
        margin: "0 0 var(--space-4)",
        border: "1px solid",
        fontSize: "0.92rem",
        background: v.bg,
        borderColor: v.bd,
        color: v.fg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </p>
  );
}
