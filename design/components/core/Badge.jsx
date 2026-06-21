import React from "react";

const TONES = {
  neutral: { bg: "var(--studio-bg-tint)", bd: "var(--studio-line)", fg: "var(--studio-muted)" },
  info: { bg: "var(--tone-info-surface)", bd: "var(--tone-info-border)", fg: "var(--tone-info-ink)" },
  success: { bg: "var(--tone-success-surface)", bd: "var(--tone-success-border)", fg: "var(--tone-success-ink)" },
  warn: { bg: "var(--tone-warn-surface)", bd: "var(--tone-warn-border)", fg: "var(--tone-warn-ink)" },
  danger: { bg: "var(--tone-danger-surface)", bd: "var(--tone-danger-border)", fg: "var(--tone-danger-ink)" },
};

/**
 * Status badge — a tiny tracked mono-caps pill. Tone maps to the semantic state palette and is the
 * primary way data state is signalled across the console (solicitation status, quote status…).
 */
export function Badge({ tone = "neutral", children, style, ...rest }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3em",
        fontFamily: "var(--font-mono)",
        fontSize: "0.7rem",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontWeight: 600,
        padding: "0.15rem 0.5rem",
        borderRadius: "var(--radius-pill)",
        border: "1px solid",
        whiteSpace: "nowrap",
        background: t.bg,
        borderColor: t.bd,
        color: t.fg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
