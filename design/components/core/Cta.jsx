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
.bg-cta{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.72rem 1.4rem;
  font-weight:600;font-size:1rem;border-radius:var(--radius-pill);text-decoration:none;border:1px solid transparent;
  cursor:pointer;transition:transform .15s ease,background .15s ease,box-shadow .15s ease,border-color .15s ease;}
.bg-cta:hover{transform:translateY(-1px);text-decoration:none;}
.bg-cta--primary{background:linear-gradient(180deg,#154a86,var(--studio-primary));color:#fff;
  box-shadow:0 10px 24px -10px rgba(11,46,89,.55),inset 0 1px 0 rgba(255,255,255,.25);}
.bg-cta--primary:hover{background:linear-gradient(180deg,#1b5495,#0a2547);box-shadow:0 14px 30px -10px rgba(11,46,89,.6);}
.bg-cta--secondary{background:var(--glass-bg);color:var(--studio-primary);border-color:var(--glass-border);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  box-shadow:0 0 0 1px rgba(11,46,89,.18),var(--glass-shadow);}
.bg-cta--secondary:hover{background:var(--glass-bg-strong);}
.bg-cta--block{width:100%;}
`;

/**
 * Call-to-action link, styled as a premium pill button. Always renders a real <a> so it stays
 * keyboard + screen-reader friendly. Use on marketing surfaces; use Button for in-app actions.
 */
export function Cta({ href = "#", variant = "primary", block = false, children, ...rest }) {
  useStyle("bg-cta-css", CSS);
  const cls = ["bg-cta", `bg-cta--${variant}`, block ? "bg-cta--block" : ""].filter(Boolean).join(" ");
  return (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  );
}
