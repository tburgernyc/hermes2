import React from "react";

/**
 * A visible "not yet final" marker (truthfulness contract). Renders an amber dot + label so a pending
 * item — a CAGE code, an unpublished address, a draft PDF — is never mistaken for a finished claim.
 */
export function PlaceholderBadge({ children = "Pending" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35em",
        padding: "0.1em 0.55em",
        fontSize: "0.78em",
        fontWeight: 600,
        lineHeight: 1.5,
        color: "var(--tone-warn-ink)",
        background: "var(--tone-warn-surface)",
        border: "1px solid var(--tone-warn-border)",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: "0.45em", height: "0.45em", borderRadius: "50%", background: "currentColor", flex: "none" }}
      />
      {children}
    </span>
  );
}
