import React from "react";

/**
 * A single headline metric for the operator's morning brief. The big value is set in thin display
 * weight; the label sits muted below. `tone="warn"` recolors the value when a count needs attention.
 */
export function Stat({ label, value, tone = "neutral" }) {
  return (
    <div
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4) var(--space-6)",
        boxShadow: "var(--glass-shadow), 0 0 0 1px rgba(16,22,29,0.03)",
      }}
    >
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 300,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          color: tone === "warn" ? "var(--tone-warn-ink)" : "var(--studio-ink)",
        }}
      >
        {value}
      </div>
      <div style={{ color: "var(--studio-muted)", fontSize: "0.85rem", marginTop: "var(--space-2)" }}>
        {label}
      </div>
    </div>
  );
}
