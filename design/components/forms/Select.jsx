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
.bg-select{display:grid;gap:var(--space-2);margin-bottom:var(--space-4);}
.bg-select__label{font-weight:600;font-size:.9rem;color:var(--studio-ink);}
.bg-select__control{width:100%;padding:.6rem 2.2rem .6rem .8rem;font:inherit;color:var(--studio-ink);
  appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;
  background-color:var(--control-bg);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right .85rem center;background-size:14px;
  border:1px solid var(--control-border);border-radius:var(--radius);box-shadow:inset 0 1px 2px rgba(16,22,29,.04);}
.bg-select__control:focus-visible{border-color:var(--studio-primary);outline:none;}
.bg-select__control option{color:var(--studio-ink);background:var(--studio-bg);}
`;

/**
 * A labeled <select>. Mirrors Field's structure so dropdowns and text inputs align in forms. Native
 * select attributes (name, value, onChange, multiple…) pass through.
 */
export function Select({ label, className, children, ...rest }) {
  useStyle("bg-select-css", CSS);
  return (
    <label className="bg-select">
      <span className="bg-select__label">{label}</span>
      <select className={["bg-select__control", className].filter(Boolean).join(" ")} {...rest}>
        {children}
      </select>
    </label>
  );
}
