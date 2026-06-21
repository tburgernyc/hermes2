import React from "react";

function useStyle(id, css) {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

const CSS = `
.bg-field{display:grid;gap:var(--space-2);margin-bottom:var(--space-4);}
.bg-field__label{font-weight:600;font-size:.9rem;color:var(--studio-ink);}
.bg-field__input{width:100%;padding:.6rem .8rem;font:inherit;color:var(--studio-ink);background:var(--control-bg);
  border:1px solid var(--control-border);border-radius:var(--radius);box-shadow:inset 0 1px 2px rgba(16,22,29,.04);}
.bg-field__input:focus-visible{border-color:var(--studio-primary);}
.bg-field__input:read-only{background:var(--studio-bg-tint);color:var(--studio-muted);}
.bg-field__hint{font-size:.8rem;color:var(--studio-muted);}
`;

/**
 * A labeled text input. The <label> wraps the <input> (implicit association); all native input
 * attributes (name, type, value, required, autoComplete…) pass straight through.
 */
export function Field({ label, hint, className, ...rest }) {
  useStyle("bg-field-css", CSS);
  return (
    <label className="bg-field">
      <span className="bg-field__label">{label}</span>
      <input className={["bg-field__input", className].filter(Boolean).join(" ")} {...rest} />
      {hint ? <span className="bg-field__hint">{hint}</span> : null}
    </label>
  );
}
