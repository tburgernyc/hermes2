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
.bg-card{position:relative;background:var(--glass-bg);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  border:1px solid var(--glass-border);border-radius:var(--radius-xl);
  box-shadow:var(--glass-shadow),inset 0 1px 0 rgba(255,255,255,.6),0 0 0 1px rgba(16,22,29,.03);
  transition:transform .2s ease,box-shadow .2s ease;}
.bg-card--md{padding:var(--space-8) var(--space-6);}
.bg-card--sm{padding:var(--space-4);border-radius:var(--radius-lg);}
.bg-card--interactive:hover{transform:translateY(-3px);box-shadow:var(--glass-shadow),var(--iris-shadow);}
`;

/**
 * The signature frosted-glass surface. Floats over the studio ground with a light-catching edge and
 * a soft diffuse shadow. `interactive` adds the hover lift used on clickable cards.
 */
export function Card({ as = "div", size = "md", interactive = false, className, children, ...rest }) {
  useStyle("bg-card-css", CSS);
  const Tag = as;
  const cls = [
    "bg-card",
    `bg-card--${size}`,
    interactive ? "bg-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
