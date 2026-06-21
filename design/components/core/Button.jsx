import React from "react";

/**
 * Injects a component's CSS once per document. Lets design-system components stay
 * self-contained (hover/focus/disabled states) while reading the global tokens.
 */
function useStyle(id, css) {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

const CSS = `
.bg-btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;font:inherit;font-weight:600;
  border-radius:var(--radius-pill);border:1px solid transparent;cursor:pointer;text-decoration:none;
  transition:transform .15s ease,background .15s ease,box-shadow .15s ease,border-color .15s ease;}
.bg-btn:hover{transform:translateY(-1px);}
.bg-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;}
.bg-btn--md{padding:.6rem 1.2rem;font-size:.95rem;}
.bg-btn--sm{padding:.4rem .85rem;font-size:.85rem;}
.bg-btn--primary{background:linear-gradient(180deg,#154a86,var(--studio-primary));color:#fff;
  box-shadow:0 10px 22px -12px rgba(11,46,89,.55),inset 0 1px 0 rgba(255,255,255,.25);}
.bg-btn--primary:hover{background:linear-gradient(180deg,#1b5495,#0a2547);}
.bg-btn--secondary{background:var(--btn-secondary-bg);color:var(--studio-primary);border-color:var(--btn-secondary-border);
  box-shadow:var(--btn-secondary-ring);}
.bg-btn--secondary:hover{background:var(--glass-bg-strong);}
.bg-btn--ghost{background:transparent;color:var(--studio-ink);border-color:var(--studio-line);}
.bg-btn--ghost:hover{background:var(--studio-bg-tint);}
.bg-btn--danger{background:var(--tone-danger-solid);color:#fff;}
.bg-btn--danger:hover{background:var(--tone-danger-solid-hover);}
.bg-btn--block{width:100%;}
`;

/**
 * Shared button. Presentational; native button attributes (type, disabled, onClick…) pass
 * straight through. Variants reuse the studio palette — primary is the gradient-navy pill.
 */
export function Button({ variant = "primary", size = "md", block = false, className, ...rest }) {
  useStyle("bg-btn-css", CSS);
  const cls = [
    "bg-btn",
    `bg-btn--${variant}`,
    `bg-btn--${size}`,
    block ? "bg-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...rest} />;
}
