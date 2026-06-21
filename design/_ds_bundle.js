/* @ds-bundle: {"format":3,"namespace":"BurgerGovDesignSystem_d0c3b4","components":[{"name":"Brand","sourcePath":"components/brand/Brand.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Cta","sourcePath":"components/core/Cta.jsx"},{"name":"PlaceholderBadge","sourcePath":"components/core/PlaceholderBadge.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Stat","sourcePath":"components/feedback/Stat.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"}],"sourceHashes":{"components/brand/Brand.jsx":"9b829b45540b","components/core/Badge.jsx":"59a11e8c64be","components/core/Button.jsx":"614f0c1e198e","components/core/Card.jsx":"38fea517d352","components/core/Cta.jsx":"2faa4a025228","components/core/PlaceholderBadge.jsx":"44c54dc12a32","components/feedback/Alert.jsx":"925a2add0444","components/feedback/Stat.jsx":"7e676618a145","components/forms/Field.jsx":"5b7aceff6c77","components/forms/Select.jsx":"f6f77d6efd28","design_handoff_console_backend_wiring/console/console-auth.jsx":"f2187ab61dd3","design_handoff_console_backend_wiring/console/console-views-admin.jsx":"3d71982a74c8","design_handoff_console_backend_wiring/console/console-views-vendor.jsx":"ebb90a099989","design_handoff_console_backend_wiring/console/data.js":"45a94e138ee1","ui_kits/console/console-auth.jsx":"f2187ab61dd3","ui_kits/console/console-views-admin.jsx":"3d71982a74c8","ui_kits/console/console-views-vendor.jsx":"ebb90a099989","ui_kits/console/data.js":"45a94e138ee1","ui_kits/marketing/data.js":"c4057744be6b","ui_kits/marketing/marketing-chrome.jsx":"219014180e8f","ui_kits/marketing/marketing-views.jsx":"d6d2b0eef009"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BurgerGovDesignSystem_d0c3b4 = window.BurgerGovDesignSystem_d0c3b4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Brand.jsx
try { (() => {
/**
 * The BurgerGov monogram + wordmark, shared across app chrome (auth cards, nav). Inline-SVG mark
 * (decorative); the brand name is real text. `size` scales the whole lockup.
 */
function Brand({
  size = "md"
}) {
  const dim = size === "lg" ? 34 : size === "sm" ? 22 : 26;
  const font = size === "lg" ? "1.6rem" : size === "sm" ? "0.95rem" : "1.05rem";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.55rem",
      fontWeight: 600,
      fontSize: font,
      letterSpacing: "-0.01em",
      color: "var(--studio-ink)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--studio-primary)",
      display: "inline-flex"
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    width: dim,
    height: dim,
    viewBox: "0 0 28 28",
    focusable: "false"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "28",
    height: "28",
    rx: "6",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 7.5h6.4c2.5 0 4 1.3 4 3.3 0 1.4-.8 2.5-2.1 2.9 1.6.3 2.6 1.5 2.6 3.1 0 2.3-1.7 3.7-4.4 3.7H9V7.5zm3 2.4v3h2.7c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5H12zm0 5.2v3.3h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.7-1.9-1.7H12z",
    fill: "#fff"
  }))), "BurgerGov");
}
Object.assign(__ds_scope, { Brand });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Brand.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    bg: "var(--studio-bg-tint)",
    bd: "var(--studio-line)",
    fg: "var(--studio-muted)"
  },
  info: {
    bg: "var(--tone-info-surface)",
    bd: "var(--tone-info-border)",
    fg: "var(--tone-info-ink)"
  },
  success: {
    bg: "var(--tone-success-surface)",
    bd: "var(--tone-success-border)",
    fg: "var(--tone-success-ink)"
  },
  warn: {
    bg: "var(--tone-warn-surface)",
    bd: "var(--tone-warn-border)",
    fg: "var(--tone-warn-ink)"
  },
  danger: {
    bg: "var(--tone-danger-surface)",
    bd: "var(--tone-danger-border)",
    fg: "var(--tone-danger-ink)"
  }
};

/**
 * Status badge — a tiny tracked mono-caps pill. Tone maps to the semantic state palette and is the
 * primary way data state is signalled across the console (solicitation status, quote status…).
 */
function Badge({
  tone = "neutral",
  children,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  ...rest
}) {
  useStyle("bg-btn-css", CSS);
  const cls = ["bg-btn", `bg-btn--${variant}`, `bg-btn--${size}`, block ? "bg-btn--block" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls
  }, rest));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function Card({
  as = "div",
  size = "md",
  interactive = false,
  className,
  children,
  ...rest
}) {
  useStyle("bg-card-css", CSS);
  const Tag = as;
  const cls = ["bg-card", `bg-card--${size}`, interactive ? "bg-card--interactive" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Cta.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function Cta({
  href = "#",
  variant = "primary",
  block = false,
  children,
  ...rest
}) {
  useStyle("bg-cta-css", CSS);
  const cls = ["bg-cta", `bg-cta--${variant}`, block ? "bg-cta--block" : ""].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Cta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Cta.jsx", error: String((e && e.message) || e) }); }

// components/core/PlaceholderBadge.jsx
try { (() => {
/**
 * A visible "not yet final" marker (truthfulness contract). Renders an amber dot + label so a pending
 * item — a CAGE code, an unpublished address, a draft PDF — is never mistaken for a finished claim.
 */
function PlaceholderBadge({
  children = "Pending"
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
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
      verticalAlign: "middle"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: "0.45em",
      height: "0.45em",
      borderRadius: "50%",
      background: "currentColor",
      flex: "none"
    }
  }), children);
}
Object.assign(__ds_scope, { PlaceholderBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/PlaceholderBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  error: {
    bg: "var(--tone-danger-surface)",
    bd: "var(--tone-danger-border)",
    fg: "var(--tone-danger-ink)"
  },
  success: {
    bg: "var(--tone-success-surface)",
    bd: "var(--tone-success-border)",
    fg: "var(--tone-success-ink)"
  },
  info: {
    bg: "var(--tone-info-surface)",
    bd: "var(--tone-info-border)",
    fg: "var(--tone-info-ink)"
  }
};

/**
 * Inline status / error message. Defaults to role="alert" (errors); pass role="status" for a
 * non-interrupting success or info message. Colors are AA on their tinted surfaces.
 */
function Alert({
  variant = "error",
  role = "alert",
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.error;
  return /*#__PURE__*/React.createElement("p", _extends({
    role: role,
    style: {
      padding: "var(--space-3) var(--space-4)",
      borderRadius: "var(--radius)",
      margin: "0 0 var(--space-4)",
      border: "1px solid",
      fontSize: "0.92rem",
      background: v.bg,
      borderColor: v.bd,
      color: v.fg,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Stat.jsx
try { (() => {
/**
 * A single headline metric for the operator's morning brief. The big value is set in thin display
 * weight; the label sits muted below. `tone="warn"` recolors the value when a count needs attention.
 */
function Stat({
  label,
  value,
  tone = "neutral"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4) var(--space-6)",
      boxShadow: "var(--glass-shadow), 0 0 0 1px rgba(16,22,29,0.03)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "2rem",
      fontWeight: 300,
      letterSpacing: "-0.02em",
      lineHeight: 1.05,
      color: tone === "warn" ? "var(--tone-warn-ink)" : "var(--studio-ink)"
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--studio-muted)",
      fontSize: "0.85rem",
      marginTop: "var(--space-2)"
    }
  }, label));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Stat.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function Field({
  label,
  hint,
  className,
  ...rest
}) {
  useStyle("bg-field-css", CSS);
  return /*#__PURE__*/React.createElement("label", {
    className: "bg-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bg-field__label"
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    className: ["bg-field__input", className].filter(Boolean).join(" ")
  }, rest)), hint ? /*#__PURE__*/React.createElement("span", {
    className: "bg-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function Select({
  label,
  className,
  children,
  ...rest
}) {
  useStyle("bg-select-css", CSS);
  return /*#__PURE__*/React.createElement("label", {
    className: "bg-select"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bg-select__label"
  }, label), /*#__PURE__*/React.createElement("select", _extends({
    className: ["bg-select__control", className].filter(Boolean).join(" ")
  }, rest), children));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// design_handoff_console_backend_wiring/console/console-auth.jsx
try { (() => {
// Console UI kit — shared chrome (nav, page header, icons, theme) + auth screens.
const {
  Brand,
  Button,
  Field,
  Badge,
  Alert
} = window.BurgerGovDesignSystem_d0c3b4;
const C = window.CONSOLE;
function SunIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  }));
}
function MoonIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  }));
}
function ThemeBtn({
  theme,
  toggleTheme
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "iconBtn",
    onClick: toggleTheme,
    "aria-label": "Toggle theme"
  }, theme === "command" ? /*#__PURE__*/React.createElement(SunIcon, null) : /*#__PURE__*/React.createElement(MoonIcon, null));
}
function AppNav({
  surface,
  route,
  go,
  theme,
  toggleTheme
}) {
  const links = surface === "admin" ? [{
    k: "admin",
    label: "Console"
  }, {
    k: "solicitations",
    label: "Solicitations"
  }, {
    k: "approvals",
    label: "Approvals"
  }, {
    k: "prospects",
    label: "Prospects"
  }, {
    k: "vendors",
    label: "Vendors"
  }, {
    k: "inquiries",
    label: "Inquiries"
  }] : [{
    k: "vendor",
    label: "Dashboard"
  }, {
    k: "rfqs",
    label: "Open RFQs"
  }, {
    k: "quotes",
    label: "My Quotes"
  }, {
    k: "contracts",
    label: "Subcontracts"
  }, {
    k: "documents",
    label: "Documents"
  }];
  // sub-routes that should highlight a parent nav item
  const activeFor = {
    "solicitation-detail": "solicitations",
    "proposal": "solicitations",
    "approval-detail": "approvals",
    "quote-submit": "rfqs",
    "quote": "quotes"
  };
  const activeKey = activeFor[route] || route;
  return /*#__PURE__*/React.createElement("header", {
    className: "navHeader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "navInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    onClick: () => go(surface === "admin" ? "admin" : "vendor")
  }, /*#__PURE__*/React.createElement(Brand, null)), /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, surface === "admin" ? "Admin · HITL" : "Subcontractor"), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, links.map(l => /*#__PURE__*/React.createElement("button", {
    key: l.k,
    className: "navLink" + (activeKey === l.k ? " active" : ""),
    onClick: () => go(l.k)
  }, l.label))), /*#__PURE__*/React.createElement("span", {
    className: "navSpacer"
  }), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  }), /*#__PURE__*/React.createElement("span", {
    className: "role"
  }, surface === "admin" ? C.operator : C.vendorName), /*#__PURE__*/React.createElement("button", {
    className: "signout",
    onClick: () => go(surface === "admin" ? "admin-login" : "vendor-login")
  }, "Sign out")));
}
function PageHeader({
  title,
  lede,
  actions,
  back
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "pageHeader"
  }, back ? /*#__PURE__*/React.createElement("div", {
    className: "pageBack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: back.onClick
  }, "\u2190 ", back.label)) : null, /*#__PURE__*/React.createElement("div", {
    className: "pageRow"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "pageTitle"
  }, title), actions ? /*#__PURE__*/React.createElement("div", {
    className: "pageActions"
  }, actions) : null), lede ? /*#__PURE__*/React.createElement("p", {
    className: "pageLede"
  }, lede) : null);
}

// Split auth screen (shared by both surfaces).
function AuthScreen({
  kind,
  go,
  theme,
  toggleTheme
}) {
  const admin = kind === "admin";
  const quote = admin ? "Nothing is sent or advanced without your explicit approval." : "Review open RFQs, prepare quotes, and submit — all from one secure workspace.";
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, quote), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, admin ? "Human-in-the-loop console" : "Subcontractor portal"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, admin ? "Admin access · TOTP required" : "Vendor access"), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, admin ? "Console sign-in" : "Subcontractor sign-in"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, admin ? "Operator credentials, then a one-time passcode." : "Access open RFQs, your quotes, and compliance documents."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      go(admin ? "admin-totp" : "vendor");
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    name: "email",
    type: "email",
    defaultValue: admin ? "t.burger@burgergov.com" : "bids@meridianfederal.com",
    autoComplete: "username"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Password",
    name: "password",
    type: "password",
    defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    autoComplete: "current-password"
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    block: true
  }, admin ? "Continue" : "Sign in")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, admin ? /*#__PURE__*/React.createElement(React.Fragment, null, "Subcontractor? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("vendor-login")
  }, "Vendor sign-in \u2192")) : /*#__PURE__*/React.createElement(React.Fragment, null, "Firm operator? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("admin-login")
  }, "Admin sign-in \u2192"))), !admin ? /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "First time, with an invitation link? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("invite-onboard")
  }, "Set up your account \u2192")) : null, /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, "\u2190 Back to burgergov.com")))));
}
function TotpScreen({
  go,
  theme,
  toggleTheme
}) {
  const [vals, setVals] = React.useState(["", "", "", "", "", ""]);
  const refs = React.useRef([]);
  function set(i, v) {
    if (!/^[0-9a-zA-Z]?$/.test(v)) return;
    const next = vals.slice();
    next[i] = v.slice(-1);
    setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every(x => x)) setTimeout(() => go("admin"), 350);
  }
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, "Zero-trust access. Six characters stand between intent and the console."), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, "TOTP verification"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, "Step 2 \xB7 One-time passcode"), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, "Enter your code"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, "From your authenticator app. The form submits on the final character."), /*#__PURE__*/React.createElement("div", {
    className: "totpRow"
  }, vals.map((v, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    ref: el => refs.current[i] = el,
    className: "totpCell",
    inputMode: "text",
    maxLength: 1,
    value: v,
    onChange: e => set(i, e.target.value),
    "aria-label": `Digit ${i + 1}`
  }))), /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => go("admin")
  }, "Verify"), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "First time? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("admin-enroll")
  }, "Set up two-factor \u2192")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("admin-login")
  }, "\u2190 Back")))));
}

// Invited-vendor onboarding — the /invite/[token] screen (set a password, once).
function InviteOnboard({
  go,
  theme,
  toggleTheme
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, "You were invited directly. This secure link sets up your account \u2014 there is no public sign-up."), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, "Single-use onboarding link"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, "Invitation \xB7 ", C.vendorName), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, "Set up your account"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, "Confirm your email and choose a password. After this, sign in anytime with your email and password."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      go("vendor");
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    name: "email",
    type: "email",
    defaultValue: C.vendorEmail,
    readOnly: true,
    "aria-readonly": "true"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Password (at least 12 characters)",
    name: "password",
    type: "password",
    defaultValue: "",
    autoComplete: "new-password"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Confirm password",
    name: "confirmPassword",
    type: "password",
    defaultValue: "",
    autoComplete: "new-password"
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    block: true
  }, "Create account")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "Already set up? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("vendor-login")
  }, "Sign in \u2192")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, "\u2190 Back to burgergov.com")))));
}

// Decorative QR matrix (demo — not scannable). Deterministic pattern + finder squares.
function FakeQR({
  seed
}) {
  const N = 25;
  const cells = [];
  // simple deterministic PRNG from a string seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) % 1000 / 1000;
  };
  const inFinder = (r, c) => {
    const f = (br, bc) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return f(0, 0) || f(0, N - 7) || f(N - 7, 0);
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (inFinder(r, c)) continue;
    if (rand() > 0.55) cells.push(/*#__PURE__*/React.createElement("rect", {
      key: r + "-" + c,
      x: c,
      y: r,
      width: "1",
      height: "1"
    }));
  }
  function Finder({
    x,
    y
  }) {
    return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: "7",
      height: "7",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: x + 2,
      y: y + 2,
      width: "3",
      height: "3"
    }));
  }
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `-1 -1 ${N + 2} ${N + 2}`,
    width: "180",
    height: "180",
    fill: "currentColor",
    shapeRendering: "crispEdges",
    role: "img",
    "aria-label": "Authenticator enrollment QR code (demo)"
  }, cells, /*#__PURE__*/React.createElement(Finder, {
    x: 0,
    y: 0
  }), /*#__PURE__*/React.createElement(Finder, {
    x: N - 7,
    y: 0
  }), /*#__PURE__*/React.createElement(Finder, {
    x: 0,
    y: N - 7
  }));
}

// First-time admin TOTP enrollment — QR + manual key + confirm code.
function EnrollScreen({
  go,
  theme,
  toggleTheme
}) {
  const KEY = "JBSWY3DPEHPK3PXP NK4F TZ2A QRST";
  const [vals, setVals] = React.useState(["", "", "", "", "", ""]);
  const refs = React.useRef([]);
  function set(i, v) {
    if (!/^[0-9]?$/.test(v)) return;
    const next = vals.slice();
    next[i] = v.slice(-1);
    setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every(x => x)) setTimeout(() => go("admin"), 350);
  }
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, "Two factors, every session. The secret is yours alone \u2014 we store only its encrypted form."), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, "TOTP enrollment"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, "Step 1 \xB7 Set up 2FA"), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, "Set up two-factor authentication"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, "Scan this QR code with your authenticator app, then enter the current code to confirm."), /*#__PURE__*/React.createElement("div", {
    className: "qrFrame"
  }, /*#__PURE__*/React.createElement(FakeQR, {
    seed: C.operator
  })), /*#__PURE__*/React.createElement("p", {
    className: "enrollKey"
  }, "Or enter this key manually:", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", {
    className: "code"
  }, KEY)), /*#__PURE__*/React.createElement("p", {
    className: "formLabel",
    style: {
      marginTop: "var(--space-4)"
    }
  }, "Confirmation code"), /*#__PURE__*/React.createElement("div", {
    className: "totpRow"
  }, vals.map((v, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    ref: el => refs.current[i] = el,
    className: "totpCell",
    inputMode: "numeric",
    maxLength: 1,
    value: v,
    onChange: e => set(i, e.target.value),
    "aria-label": `Digit ${i + 1}`
  }))), /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => go("admin")
  }, "Confirm"), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "Already enrolled? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("admin-totp")
  }, "Enter your code \u2192")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("admin-login")
  }, "\u2190 Back")))));
}
window.ConsoleAuth = {
  AppNav,
  PageHeader,
  AuthScreen,
  TotpScreen,
  InviteOnboard,
  EnrollScreen,
  ThemeBtn
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "design_handoff_console_backend_wiring/console/console-auth.jsx", error: String((e && e.message) || e) }); }

// design_handoff_console_backend_wiring/console/console-views-admin.jsx
try { (() => {
// Console UI kit — ADMIN surface views (the full operator pipeline).
const {
  Badge,
  Button,
  Field
} = window.BurgerGovDesignSystem_d0c3b4;
const CON = window.CONSOLE;
const {
  PageHeader
} = window.ConsoleAuth;
function StatGrid({
  stats
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "statGrid"
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "stat" + (s.tone === "warn" ? " warn" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "statValue"
  }, s.value), /*#__PURE__*/React.createElement("div", {
    className: "statLabel"
  }, s.label))));
}

/* ---------- MORNING BRIEF ---------- */
function AdminHome({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Morning brief",
    lede: "Everything awaiting a human decision, as of 06:00 EDT. Rendering this page never advances any state."
  }), /*#__PURE__*/React.createElement(StatGrid, {
    stats: CON.brief.stats
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Awaiting a sourcing decision ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.triaged.length, ")")), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("solicitations")
  }, "Open board \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.triaged.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("solicitation-detail")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency, " \xB7 fit ", s.fit)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scoreBar",
    title: "feasibility " + s.feasibility
  }, /*#__PURE__*/React.createElement("div", {
    className: "scoreFill",
    style: {
      width: s.feasibility + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, s.feasibility))))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "New contact inquiries"), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("inquiries")
  }, "Open inbox \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.inquiries.filter(i => i.status === "NEW").map(i => /*#__PURE__*/React.createElement("li", {
    key: i.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("inquiries")
  }, i.company), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, i.name, " \xB7 ", i.intent)), /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "new")))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Response deadlines within 72h ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.deadlines.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.deadlines.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", null, s.title), /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "due ", s.due)))))));
}

/* ---------- SOLICITATIONS KANBAN ---------- */
function SolicitationsBoard({
  go,
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Solicitations",
    lede: "Sourced from SAM.gov and triaged by the AI \u2014 a recommendation only. You decide what advances; rendering the board sends nothing."
  }), /*#__PURE__*/React.createElement("div", {
    className: "kanban"
  }, CON.board.map(col => /*#__PURE__*/React.createElement("section", {
    key: col.title,
    className: "column"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "columnHead"
  }, col.title, " ", /*#__PURE__*/React.createElement("span", {
    className: "columnCount"
  }, "(", col.items.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "columnCards"
  }, col.items.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "empty"
  }, "\u2014") : col.items.map(s => /*#__PURE__*/React.createElement("article", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("solicitation-detail")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginTop: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(Badge, null, s.status), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, "feas ", s.feasibility, " \xB7 fit ", s.fit)), s.gate ? /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginTop: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct("Sourcing approved — outreach drafting queued for your review.")
  }, "Approve sourcing"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct("Marked no-go — solicitation archived.")
  }, "No-go")) : null)))))));
}

/* ---------- SOLICITATION DETAIL (ranked quotes) ---------- */
function SolicitationDetail({
  go,
  onAct
}) {
  const d = CON.solicitationDetail;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: d.title,
    lede: `${d.agency} · ${d.status} · due ${d.deadline}`,
    back: {
      label: "Solicitations",
      onClick: () => go("solicitations")
    },
    actions: /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "feasibility ", d.feasibility), /*#__PURE__*/React.createElement(Badge, null, d.contractType))
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Triage recommendation"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      marginBottom: "var(--space-3)"
    }
  }, "Notice ", d.notice, " \xB7 NAICS ", d.naics, " \xB7 fit ", d.fit), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--studio-ink)",
      lineHeight: 1.6
    }
  }, d.scope), d.concerns.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Flagged concerns"), /*#__PURE__*/React.createElement("ul", {
    className: "bulletList"
  }, d.concerns.map((c, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, c)))) : null)), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Subcontractor quotes \u2014 AI-ranked ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", d.quotes.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, d.quotes.map(q => /*#__PURE__*/React.createElement("li", {
    key: q.id,
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rankPill"
  }, "#", q.rank), /*#__PURE__*/React.createElement("strong", null, q.vendor)), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, q.status, " \xB7 ", q.total)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct(`${q.vendor} shortlisted.`)
  }, "Shortlist"), q.rank === 1 ? /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct(`${q.vendor} selected as winner — priced bid draft will be generated for your review.`)
  }, "Select winner") : null)), /*#__PURE__*/React.createElement("div", {
    className: "rationale"
  }, q.rationale)))), /*#__PURE__*/React.createElement("p", {
    className: "meta"
  }, "Selecting a winner records your choice; the priced bid draft is generated for review in the next step \u2014 nothing is submitted to the government automatically."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("proposal")
  }, "\u2192 Review the priced bid decision-brief"))));
}

/* ---------- PROPOSAL DECISION-BRIEF ---------- */
function ChecklistRows({
  items
}) {
  return /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, items.map((ci, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "row",
    style: {
      gap: "var(--space-3)",
      padding: "var(--space-2) 0"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: ci.passed ? "success" : "warn"
  }, ci.passed ? "PASS" : "REVIEW"), /*#__PURE__*/React.createElement("span", null, ci.item, ci.note ? ` — ${ci.note}` : ""))));
}
function ProposalBrief({
  go,
  onAct
}) {
  const p = CON.proposal;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Bid decision-brief",
    lede: `${p.title} · status ${p.status} · ${p.contractType}${p.provisional ? " · PROVISIONAL (dry-run baseline)" : ""}`,
    back: {
      label: "Solicitation",
      onClick: () => go("solicitation-detail")
    }
  }), p.watermark ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, p.watermark)) : null, /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Pricing scenarios ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", p.scenarios.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Scenario"), /*#__PURE__*/React.createElement("th", null, "Price"), /*#__PURE__*/React.createElement("th", null, "Fee %"), /*#__PURE__*/React.createElement("th", null, "Margin %"), /*#__PURE__*/React.createElement("th", null, "vs. benchmark median"))), /*#__PURE__*/React.createElement("tbody", null, p.scenarios.map((s, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, s.label), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.price), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.feePct), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.marginPct), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.vsBench)))))), /*#__PURE__*/React.createElement("p", {
    className: "meta"
  }, "Scenarios are a decision aid \u2014 you choose the number; the system never picks one.")), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Compliance checklist"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(ChecklistRows, {
    items: p.compliance
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Bid checklist"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(ChecklistRows, {
    items: p.bidChecklist
  })))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Live-submission blockers"), /*#__PURE__*/React.createElement("div", {
    className: "card blockerCard"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 0
    }
  }, "This bid ", /*#__PURE__*/React.createElement("strong", null, "cannot"), " be submitted yet. The following must be resolved before any real bid leaves the building:"), /*#__PURE__*/React.createElement("ul", {
    className: "bulletList"
  }, p.blockers.map((b, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, b))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Review workflow"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Draft \u2192 Counsel review \u2192 Ready to submit \u2192 Submit"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "Each transition is a separate human action. Submission stays blocked while any live gate fails.")), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct("Counsel review recorded.")
  }, "Record counsel review"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    disabled: true,
    title: "Blocked by live-submission gates"
  }, "Mark ready"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    disabled: true,
    title: "Blocked by live-submission gates"
  }, "Submit to agency"))))));
}

/* ---------- APPROVALS ---------- */
function ApprovalsView({
  go,
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Approvals",
    lede: "Each button is the only emitter of a human-gate event. Nothing is sent or advanced without your explicit approval.",
    back: {
      label: "Console",
      onClick: () => go("admin")
    }
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Solicitations awaiting a sourcing decision ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.triaged.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.triaged.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("approval-detail")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency, " \xB7 feasibility ", s.feasibility, " \xB7 fit ", s.fit)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => go("approval-detail")
  }, "Open split-view"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct("Sourcing approved — outreach drafting queued.")
  }, "Approve sourcing"))))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Outreach awaiting approval ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.outreach.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.outreach.map(o => /*#__PURE__*/React.createElement("li", {
    key: o.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, o.subject), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, "to ", o.prospect)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct("Outreach approved & sent.")
  }, "Approve & send"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct("Outreach rejected.")
  }, "Reject"))))))));
}

// Long-press release gate — hold 1.5s to dispatch; release early resets.
function ReleaseGate({
  onComplete
}) {
  const [pct, setPct] = React.useState(0);
  const raf = React.useRef(null);
  const start = React.useRef(0);
  const done = React.useRef(false);
  const DUR = 1500;
  function begin() {
    done.current = false;
    start.current = performance.now();
    const step = t => {
      const p = Math.min(100, (t - start.current) / DUR * 100);
      setPct(p);
      if (p >= 100) {
        done.current = true;
        onComplete();
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }
  function end() {
    cancelAnimationFrame(raf.current);
    if (!done.current) setPct(0);
  }
  return /*#__PURE__*/React.createElement("button", {
    className: "gateBtn",
    onMouseDown: begin,
    onMouseUp: end,
    onMouseLeave: end,
    onTouchStart: begin,
    onTouchEnd: end
  }, /*#__PURE__*/React.createElement("span", {
    className: "gateFill",
    style: {
      width: pct + "%"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "gateLabel"
  }, pct >= 100 ? "Dispatched ✓" : "Hold to release bid"));
}
function ApprovalDetail({
  go,
  onAct
}) {
  const d = CON.approvalDetail;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: d.title,
    lede: `${d.agency} · Notice ${d.notice}`,
    back: {
      label: "Approvals",
      onClick: () => go("approvals")
    },
    actions: /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "feasibility ", d.feasibility)
  }), /*#__PURE__*/React.createElement("div", {
    className: "split",
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("span", {
    className: "paneLabel"
  }, "Source solicitation \xB7 locked"), d.sourceLines.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "docLine"
  }, l))), /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("span", {
    className: "paneLabel"
  }, "AI evaluation \xB7 editable"), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap",
    style: {
      border: "none",
      boxShadow: "none",
      background: "transparent"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Line item"), /*#__PURE__*/React.createElement("th", null, "Markup"), /*#__PURE__*/React.createElement("th", null, "Vendor / note"))), /*#__PURE__*/React.createElement("tbody", null, d.evalLines.map((e, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, e.item), /*#__PURE__*/React.createElement("td", null, e.flag ? /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, e.markup) : /*#__PURE__*/React.createElement(Badge, null, e.markup)), /*#__PURE__*/React.createElement("td", {
    className: e.flag ? "docLine flag" : "",
    style: {
      border: "none",
      padding: 0
    }
  }, e.vendor)))))))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Dispatch the assembled bid to the client"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "Press and hold to confirm \u2014 this prevents accidental release.")), /*#__PURE__*/React.createElement(ReleaseGate, {
    onComplete: () => onAct("Bid dispatched — row locked. Payload sent to client.")
  }))));
}

/* ---------- INQUIRIES INBOX ---------- */
function InquiriesView({
  onAct
}) {
  const newCount = CON.inquiries.filter(i => i.status === "NEW").length;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Contact inquiries",
    lede: `${CON.inquiries.length} total · ${newCount} new. Submitted from the public site; visitor text is shown as data, never executed.`
  }), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.inquiries.map(i => /*#__PURE__*/React.createElement("li", {
    key: i.id,
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, i.name), " \xB7 ", i.email, /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, i.company)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, i.intent), /*#__PURE__*/React.createElement(Badge, {
    tone: i.status === "NEW" ? "warn" : "neutral"
  }, i.status), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, i.date))), /*#__PURE__*/React.createElement("blockquote", {
    className: "inquiryQuote"
  }, i.message), i.status === "NEW" ? /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => onAct("Inquiry marked reviewed.")
  }, "Mark reviewed") : null))));
}

/* ---------- PROSPECTS ---------- */
function ProspectsView({
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Prospects",
    lede: "Subcontractor candidates from AI discovery and inbound inquiries. Qualifying a prospect makes it promotable to a vetted vendor."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Add a prospect"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formGrid"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Company",
    name: "companyName",
    placeholder: "Acme Federal LLC"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    name: "contactEmail",
    type: "email",
    placeholder: "bids@acme.com"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "NAICS",
    name: "naics",
    placeholder: "541511, 541512"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Capabilities",
    name: "capabilities",
    placeholder: "Accessible UI, PostgreSQL\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => onAct("Prospect added.")
  }, "Add prospect")))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "All prospects ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.prospects.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.prospects.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, p.company), " \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, p.email), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginTop: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: p.status === "Qualified" ? "success" : "neutral"
  }, p.status), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, p.source), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, "NAICS ", p.naics, " \xB7 score ", p.score))), p.status !== "Qualified" ? /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => onAct(`${p.company} marked qualified.`)
  }, "Mark qualified") : null))))));
}

/* ---------- VENDORS (promote / vet / link / invite) ---------- */
function VendorsView({
  onAct
}) {
  const v = CON.vendors;
  const [copied, setCopied] = React.useState(false);
  function copy() {
    setCopied(true);
    onAct("Single-use onboarding link generated — copy it and send it to the vendor yourself.");
    if (navigator.clipboard) navigator.clipboard.writeText(v.inviteLink).catch(() => {});
    setTimeout(() => setCopied(false), 2500);
  }
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Vendors",
    lede: "Promote qualified prospects, vet vendors, link vendor users, and generate single-use onboarding invitations. The app never emails on its own \u2014 you send the link."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Qualified prospects ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", v.qualifiedProspects.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, v.qualifiedProspects.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("strong", null, p.company), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct(`${p.company} promoted to vendor (pending vetting).`)
  }, "Promote to vendor")))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Vendors awaiting vetting ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", v.pendingVendors.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, v.pendingVendors.map(x => /*#__PURE__*/React.createElement("li", {
    key: x.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("strong", null, x.company), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct(`${x.company} marked vetted.`)
  }, "Mark vetted")))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Link a vendor user"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginTop: 0
    }
  }, "Binding a VENDOR-role user to a vetted vendor is admin-only \u2014 never self-asserted."), /*#__PURE__*/React.createElement("div", {
    className: "formGrid"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "User",
    name: "userId",
    placeholder: "ops@cobaltcivic.com"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Vendor",
    name: "vendorId",
    placeholder: "Cobalt Civic Tech"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => onAct("Vendor user linked.")
  }, "Link")))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Invite a vendor user"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginTop: 0
    }
  }, "Generates a single-use onboarding link tied to one vetted vendor. Copy it and send it to the vendor yourself."), /*#__PURE__*/React.createElement("div", {
    className: "formGrid"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Vendor",
    name: "inviteVendor",
    placeholder: "Meridian Federal LLC"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Invitee email",
    name: "inviteEmail",
    type: "email",
    placeholder: "bids@meridianfederal.com"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    },
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: copy
  }, copied ? "Copied ✓" : "Generate & copy link")), copied ? /*#__PURE__*/React.createElement("div", {
    className: "inviteLink"
  }, v.inviteLink) : null)));
}
window.ConsoleAdmin = {
  AdminHome,
  SolicitationsBoard,
  SolicitationDetail,
  ProposalBrief,
  ApprovalsView,
  ApprovalDetail,
  InquiriesView,
  ProspectsView,
  VendorsView,
  StatGrid
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "design_handoff_console_backend_wiring/console/console-views-admin.jsx", error: String((e && e.message) || e) }); }

// design_handoff_console_backend_wiring/console/console-views-vendor.jsx
try { (() => {
// Console UI kit — VENDOR (subcontractor) surface views.
const {
  Badge: VBadge,
  Button: VButton,
  Field: VField
} = window.BurgerGovDesignSystem_d0c3b4;
const VCON = window.CONSOLE;
const {
  PageHeader: VPageHeader
} = window.ConsoleAuth;
const {
  StatGrid: VStatGrid
} = window.ConsoleAdmin;

/* ---------- DASHBOARD ---------- */
function VendorHome({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Subcontractor dashboard",
    lede: `Welcome back, ${VCON.vendorName}. Here's what needs your attention.`
  }), /*#__PURE__*/React.createElement(VStatGrid, {
    stats: VCON.vendorStats
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Open RFQs ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", VCON.rfqs.length, ")")), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("rfqs")
  }, "View all \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, VCON.rfqs.slice(0, 2).map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote-submit")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency, " \xB7 NAICS ", s.naics)), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, "due ", s.deadline)))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "My quotes"), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("quotes")
  }, "View all \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, VCON.myQuotes.map(q => /*#__PURE__*/React.createElement("li", {
    key: q.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote")
  }, q.title), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tableNum"
  }, q.total), /*#__PURE__*/React.createElement(VBadge, {
    tone: q.status === "Submitted" ? "success" : "info"
  }, q.status))))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Compliance documents"), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("documents")
  }, "Manage \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, VCON.documents.slice(0, 3).map((d, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "metaMono",
    style: {
      color: "var(--studio-ink)"
    }
  }, d.name), /*#__PURE__*/React.createElement(VBadge, {
    tone: d.tone
  }, d.status)))))));
}

/* ---------- OPEN RFQS ---------- */
function RfqsView({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Open RFQs",
    lede: "Solicitations the firm is currently sourcing subcontractor quotes for."
  }), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Title"), /*#__PURE__*/React.createElement("th", null, "Agency"), /*#__PURE__*/React.createElement("th", null, "NAICS"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Response deadline"), /*#__PURE__*/React.createElement("th", null, "Action"))), /*#__PURE__*/React.createElement("tbody", null, VCON.rfqs.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id
  }, /*#__PURE__*/React.createElement("td", null, s.title), /*#__PURE__*/React.createElement("td", null, s.agency), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.naics), /*#__PURE__*/React.createElement("td", null, s.contractType), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.deadline), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote-submit")
  }, "Submit quote"))))))));
}

/* ---------- QUOTE SUBMISSION FORM ---------- */
function QuoteSubmitView({
  go,
  onAct
}) {
  const t = VCON.quoteTarget;
  const ROWS = [0, 1, 2];
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Submit a quote",
    lede: "Enter your line items, terms, and upload your quote document. Nothing is shared with other subcontractors.",
    back: {
      label: "Open RFQs",
      onClick: () => go("rfqs")
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      margin: 0
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      margin: "var(--space-2) 0"
    }
  }, t.agency, " \xB7 Notice ", t.notice, " \xB7 ", t.contractType, " \xB7 due ", t.deadline), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--studio-ink)",
      lineHeight: 1.6
    }
  }, t.scope)), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Line items"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: "var(--space-6)"
    }
  }, ROWS.map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "lineRow"
  }, /*#__PURE__*/React.createElement("select", {
    className: "lineSelect",
    "aria-label": `Cost type ${i + 1}`,
    defaultValue: "Labor"
  }, t.costTypes.map(ct => /*#__PURE__*/React.createElement("option", {
    key: ct,
    value: ct
  }, ct))), /*#__PURE__*/React.createElement("input", {
    className: "lineInput",
    placeholder: "Description",
    "aria-label": `Description ${i + 1}`
  }), /*#__PURE__*/React.createElement("input", {
    className: "lineInput",
    type: "number",
    placeholder: "Qty",
    defaultValue: "1",
    "aria-label": `Quantity ${i + 1}`
  }), /*#__PURE__*/React.createElement("input", {
    className: "lineInput",
    type: "number",
    placeholder: "Unit rate (USD)",
    "aria-label": `Unit rate ${i + 1}`
  }))), /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginBottom: 0
    }
  }, "Enter at least one line item. Leave unused rows blank.")), /*#__PURE__*/React.createElement("div", {
    className: "formGrid",
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(VField, {
    label: "Period of performance",
    name: "pop",
    placeholder: "e.g. 12 months"
  }), /*#__PURE__*/React.createElement("label", {
    className: "checkRow"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    defaultChecked: true
  }), " Pay-when-paid terms acceptable")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "formLabel"
  }, "Notes"), /*#__PURE__*/React.createElement("textarea", {
    className: "lineInput",
    rows: 4,
    placeholder: "Anything the firm should know about your quote\u2026",
    style: {
      width: "100%",
      resize: "vertical"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "card uploadZone",
    onClick: () => onAct("File attached — quote_meridian.pdf (validated)."),
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      color: "var(--studio-primary)",
      fontSize: "1.4rem"
    }
  }, "\u2B06"), /*#__PURE__*/React.createElement("strong", null, "Quote document (PDF or DOCX, max 25 MB)"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "Magic-byte validated \xB7 signed-URL upload")), /*#__PURE__*/React.createElement(VButton, {
    onClick: () => onAct("Quote submitted for review. No further action needed.")
  }, "Submit quote"));
}

/* ---------- MY QUOTES ---------- */
function MyQuotesView({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "My quotes",
    lede: "Quotes you've submitted, with their current review status."
  }), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Solicitation"), /*#__PURE__*/React.createElement("th", null, "Agency"), /*#__PURE__*/React.createElement("th", null, "Total"), /*#__PURE__*/React.createElement("th", null, "Submitted"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, VCON.myQuotes.map(q => /*#__PURE__*/React.createElement("tr", {
    key: q.id
  }, /*#__PURE__*/React.createElement("td", null, q.title), /*#__PURE__*/React.createElement("td", null, q.agency), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, q.total), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, q.date), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: q.status === "Submitted" ? "success" : "info"
  }, q.status)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote")
  }, "View \u2192"))))))));
}

/* ---------- QUOTE DETAIL ---------- */
function QuoteView({
  go
}) {
  const q = VCON.quote;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: q.title,
    lede: `Notice ${q.notice}`,
    back: {
      label: "My quotes",
      onClick: () => go("quotes")
    },
    actions: /*#__PURE__*/React.createElement(VBadge, {
      tone: "success"
    }, q.status)
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, /*#__PURE__*/React.createElement("li", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Total price"), /*#__PURE__*/React.createElement("span", {
    className: "tableNum",
    style: {
      fontSize: "1.1rem"
    }
  }, q.total)), /*#__PURE__*/React.createElement("li", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Period of performance"), /*#__PURE__*/React.createElement("span", null, q.pop)), /*#__PURE__*/React.createElement("li", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Pay-when-paid"), /*#__PURE__*/React.createElement("span", null, q.payWhenPaid ? "Yes" : "No")))), q.notes ? /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-3)"
    }
  }, "Notes"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--studio-ink)",
      lineHeight: 1.6
    }
  }, q.notes)) : null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Line items"), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Cost type"), /*#__PURE__*/React.createElement("th", null, "Description"), /*#__PURE__*/React.createElement("th", null, "Qty"), /*#__PURE__*/React.createElement("th", null, "Unit rate"), /*#__PURE__*/React.createElement("th", null, "Extended"))), /*#__PURE__*/React.createElement("tbody", null, q.lines.map((l, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, l.cost), /*#__PURE__*/React.createElement("td", null, l.desc), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, l.qty), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, l.rate), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, l.ext)))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", {
    className: "tfoot"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: 4
  }, "Total"), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, q.total))))));
}

/* ---------- MY SUBCONTRACTS ---------- */
function ContractsView() {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "My subcontracts",
    lede: "Contracts awarded to you, with execution and e-signature status."
  }), VCON.contracts.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "empty"
  }, "You have no subcontracts yet.") : /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Solicitation"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Value"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "E-sign"))), /*#__PURE__*/React.createElement("tbody", null, VCON.contracts.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", null, r.title), /*#__PURE__*/React.createElement("td", null, r.contractType), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, r.value), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: r.status === "Active" ? "success" : "info"
  }, r.status)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: r.esign === "Signed" ? "success" : "warn"
  }, r.esign))))))));
}

/* ---------- DOCUMENTS ---------- */
function DocumentsView({
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Compliance documents",
    lede: "Drop a document to begin validation. Background workers scan and verify each file."
  }), /*#__PURE__*/React.createElement("div", {
    className: "card uploadZone",
    onClick: () => onAct("Upload started — scanning Past performance — VA.pdf…"),
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      color: "var(--studio-primary)",
      fontSize: "1.5rem",
      marginBottom: "0.5rem"
    }
  }, "\u2B06"), /*#__PURE__*/React.createElement("strong", null, "Drop a compliance document here"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "PDF \xB7 magic-byte validated \xB7 signed-URL upload")), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "File"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, VCON.documents.map((d, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "tableNum",
    style: {
      color: "var(--studio-ink)"
    }
  }, d.name), /*#__PURE__*/React.createElement("td", null, d.type), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: d.tone
  }, d.status))))))));
}
window.ConsoleVendor = {
  VendorHome,
  RfqsView,
  QuoteSubmitView,
  MyQuotesView,
  QuoteView,
  ContractsView,
  DocumentsView
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "design_handoff_console_backend_wiring/console/console-views-vendor.jsx", error: String((e && e.message) || e) }); }

// design_handoff_console_backend_wiring/console/data.js
try { (() => {
// Console UI kit data — the FULL operator + subcontractor workflow, end to end.
// Synthetic but shaped like the real hermes2 schema. Truthfulness contract preserved:
// nothing advances without an explicit human action; live submission is gated.
window.CONSOLE = {
  operator: "t.burger@burgergov.com",
  vendorName: "Meridian Federal LLC",
  vendorEmail: "bids@meridianfederal.com",
  // ---- Admin: morning brief ----
  brief: {
    stats: [{
      label: "Awaiting sourcing decision",
      value: 3,
      tone: "neutral"
    }, {
      label: "Outreach awaiting approval",
      value: 2,
      tone: "warn"
    }, {
      label: "In pricing / bid review",
      value: 2,
      tone: "neutral"
    }, {
      label: "Deadlines within 72h",
      value: 2,
      tone: "warn"
    }, {
      label: "New contact inquiries",
      value: 2,
      tone: "warn"
    }]
  },
  triaged: [{
    id: "s1",
    title: "Logistics scheduling system modernization",
    agency: "DLA Troop Support",
    feasibility: 88,
    fit: "High"
  }, {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    agency: "Dept. of Veterans Affairs",
    feasibility: 81,
    fit: "High"
  }, {
    id: "s3",
    title: "Records database migration to PostgreSQL",
    agency: "GSA FAS",
    feasibility: 74,
    fit: "Medium"
  }],
  outreach: [{
    id: "o1",
    subject: "Subcontractor capability — accessible UI remediation (VA)",
    prospect: "Meridian Federal LLC"
  }, {
    id: "o2",
    subject: "Teaming inquiry — PostgreSQL migration (GSA)",
    prospect: "Anchor Data Systems"
  }],
  pricing: [{
    id: "s4",
    title: "Cybersecurity dashboard build-out"
  }, {
    id: "s5",
    title: "Grants management web application"
  }],
  deadlines: [{
    id: "s1",
    title: "Logistics scheduling system modernization",
    due: "2026-06-22 17:00 EDT"
  }, {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    due: "2026-06-23 12:00 EDT"
  }],
  // ---- Admin: solicitations kanban (5 operator phases) ----
  board: [{
    title: "Triage",
    items: [{
      id: "s2",
      title: "Section 508 audit & accessible UI remediation",
      agency: "Dept. of Veterans Affairs",
      status: "Triage complete",
      feasibility: 81,
      fit: "High",
      gate: true
    }, {
      id: "s3",
      title: "Records database migration to PostgreSQL",
      agency: "GSA FAS",
      status: "Triage complete",
      feasibility: 74,
      fit: "Medium",
      gate: true
    }]
  }, {
    title: "Sourcing",
    items: [{
      id: "s1",
      title: "Logistics scheduling system modernization",
      agency: "DLA Troop Support",
      status: "Sourcing in progress",
      feasibility: 88,
      fit: "High"
    }]
  }, {
    title: "Pricing",
    items: [{
      id: "s4",
      title: "Cybersecurity dashboard build-out",
      agency: "DHS CISA",
      status: "Pricing pending",
      feasibility: 79,
      fit: "High"
    }]
  }, {
    title: "Proposal",
    items: [{
      id: "s5",
      title: "Grants management web application",
      agency: "HHS",
      status: "Proposal draft",
      feasibility: 83,
      fit: "High"
    }]
  }, {
    title: "Submitted",
    items: [{
      id: "s6",
      title: "Case management API integration",
      agency: "USDA",
      status: "Submitted",
      feasibility: 85,
      fit: "High"
    }]
  }],
  // ---- Admin: solicitation detail (triage + ranked quotes) ----
  solicitationDetail: {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    agency: "Dept. of Veterans Affairs",
    notice: "36C10B26R0042",
    status: "Sourcing in progress",
    deadline: "2026-06-23 12:00 EDT",
    feasibility: 81,
    fit: "High",
    contractType: "FFP",
    naics: "541511",
    concerns: ["Key personnel must include a certified accessibility specialist — confirm before award."],
    scope: "The contractor shall conduct a full Section 508 conformance audit of the VA claims portal, remediate all Level A and AA failures per WCAG 2.1, and deliver automated and manual testing artifacts. Period of performance: 12 months from award. Key personnel must include a certified accessibility specialist.",
    quotes: [{
      id: "q1",
      vendor: "Meridian Federal LLC",
      status: "Submitted",
      total: "$248,500.00",
      rank: 1,
      rationale: "Strongest accessibility past performance; certified specialist named. Pricing 4% below benchmark median."
    }, {
      id: "q2",
      vendor: "Anchor Data Systems",
      status: "Submitted",
      total: "$262,000.00",
      rank: 2,
      rationale: "Solid testing methodology; specialist certification not yet evidenced. Pricing at benchmark median."
    }, {
      id: "q3",
      vendor: "Cobalt Civic Tech",
      status: "Submitted",
      total: "$291,750.00",
      rank: 3,
      rationale: "Capable team; highest price and lighter 508-specific past performance."
    }]
  },
  // ---- Admin: priced bid decision-brief ----
  proposal: {
    title: "Section 508 audit & accessible UI remediation",
    status: "Draft",
    contractType: "FFP",
    provisional: true,
    watermark: "PROVISIONAL — dry-run baseline · not for submission",
    scenarios: [{
      label: "Conservative",
      price: "$268,200",
      feePct: "8.0%",
      marginPct: "11.4%",
      vsBench: "+2.1%"
    }, {
      label: "Target",
      price: "$261,000",
      feePct: "10.0%",
      marginPct: "13.8%",
      vsBench: "−0.6%"
    }, {
      label: "Aggressive",
      price: "$252,400",
      feePct: "12.5%",
      marginPct: "16.2%",
      vsBench: "−3.9%"
    }],
    compliance: [{
      item: "FAR 52.204-24 representation present",
      passed: true
    }, {
      item: "Section 508 VPAT attached",
      passed: true
    }, {
      item: "Key personnel resumes — certified specialist",
      passed: false,
      note: "Awaiting signed certification"
    }, {
      item: "SAM.gov registration active at submission",
      passed: true
    }],
    bidChecklist: [{
      item: "Technical volume assembled",
      passed: true
    }, {
      item: "Price volume reconciled to line items",
      passed: true
    }, {
      item: "Subcontractor teaming agreement executed",
      passed: false,
      note: "Pending counsel review"
    }, {
      item: "Representations & certifications complete",
      passed: true
    }],
    blockers: ["CAGE code not yet assigned (pending) — required for SAM submission.", "Subcontractor teaming agreement awaiting counsel signature.", "Certified accessibility specialist certification not yet on file."]
  },
  // ---- Admin: contact inquiries (from the marketing site) ----
  inquiries: [{
    id: "i1",
    name: "Dana Whitfield",
    email: "dwhitfield@primecontractor.com",
    company: "Atlas Integrated Systems (Prime)",
    intent: "Teaming",
    status: "NEW",
    date: "2026-06-19",
    message: "We're bidding a VA modernization vehicle and need a 541511 partner with Section 508 depth. Are you available to discuss a teaming arrangement?"
  }, {
    id: "i2",
    name: "Capt. R. Alvarez",
    email: "r.alvarez@agency.gov",
    company: "DLA Troop Support",
    intent: "Capability",
    status: "NEW",
    date: "2026-06-18",
    message: "Requesting a capability statement for upcoming logistics scheduling modernization work under 541512."
  }, {
    id: "i3",
    name: "Priya Natarajan",
    email: "pnatarajan@anchordata.com",
    company: "Anchor Data Systems",
    intent: "Subcontractor",
    status: "Reviewed",
    date: "2026-06-15",
    message: "Interested in subcontracting on database migration efforts. PostgreSQL and accessibility experience available."
  }],
  // ---- Admin: prospects (discovery + qualify) ----
  prospects: [{
    id: "p1",
    company: "Meridian Federal LLC",
    email: "bids@meridianfederal.com",
    status: "Qualified",
    source: "AI discovery",
    score: 92,
    naics: "541511, 541512"
  }, {
    id: "p2",
    company: "Anchor Data Systems",
    email: "pnatarajan@anchordata.com",
    status: "Contacted",
    source: "Inbound inquiry",
    score: 84,
    naics: "541512"
  }, {
    id: "p3",
    company: "Cobalt Civic Tech",
    email: "team@cobaltcivic.com",
    status: "Discovered",
    source: "AI discovery",
    score: 77,
    naics: "541511, 541519"
  }, {
    id: "p4",
    company: "Northwind Systems Group",
    email: "rfp@northwindsg.com",
    status: "Discovered",
    source: "AI discovery",
    score: 71,
    naics: "541512"
  }],
  // ---- Admin: vendors (promote / vet / link / invite) ----
  vendors: {
    qualifiedProspects: [{
      id: "p1",
      company: "Meridian Federal LLC"
    }],
    pendingVendors: [{
      id: "v2",
      company: "Anchor Data Systems"
    }],
    vettedVendors: [{
      id: "v1",
      company: "Meridian Federal LLC"
    }, {
      id: "v3",
      company: "Cobalt Civic Tech"
    }],
    unlinkedUsers: [{
      id: "u2",
      email: "ops@cobaltcivic.com"
    }],
    inviteLink: "https://burgergov.com/invite/eyJhbGciOiJFUzI1Ni…s9-VENDOR_INVITE-single-use"
  },
  // ---- Vendor: dashboard ----
  vendorStats: [{
    label: "Open RFQs to bid",
    value: 3,
    tone: "neutral"
  }, {
    label: "Active quotes",
    value: 2,
    tone: "neutral"
  }, {
    label: "Awaiting your docs",
    value: 1,
    tone: "warn"
  }, {
    label: "Awarded YTD",
    value: 1,
    tone: "neutral"
  }],
  rfqs: [{
    id: "r1",
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    naics: "541511",
    deadline: "2026-06-30",
    contractType: "FFP"
  }, {
    id: "r2",
    title: "PostgreSQL records migration",
    agency: "GSA FAS",
    naics: "541512",
    deadline: "2026-07-08",
    contractType: "T&M"
  }, {
    id: "r3",
    title: "Logistics scheduling modernization",
    agency: "DLA Troop Support",
    naics: "541511",
    deadline: "2026-07-15",
    contractType: "FFP"
  }],
  // ---- Vendor: quote submission target (the form's solicitation) ----
  quoteTarget: {
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    notice: "SP4701-26-R-0042",
    contractType: "FFP",
    deadline: "2026-06-30",
    scope: "Remediate all Level A and AA Section 508 / WCAG 2.1 failures across the claims portal, deliver automated and manual testing artifacts, and provide a certified accessibility specialist as key personnel. Period of performance: 12 months.",
    costTypes: ["Labor", "Material", "ODC", "Subcontract", "Travel"]
  },
  // ---- Vendor: my quotes ----
  myQuotes: [{
    id: "mq1",
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    total: "$248,500.00",
    status: "Submitted",
    date: "2026-06-17"
  }, {
    id: "mq2",
    title: "PostgreSQL records migration",
    agency: "GSA FAS",
    total: "$176,300.00",
    status: "Under review",
    date: "2026-06-12"
  }],
  // ---- Vendor: single quote detail ----
  quote: {
    title: "Accessible UI remediation — claims portal",
    notice: "SP4701-26-R-0042",
    status: "Submitted",
    total: "$248,500.00",
    pop: "12 months",
    payWhenPaid: true,
    notes: "Certified accessibility specialist (IAAP CPACC) named as key personnel; resume attached.",
    lines: [{
      cost: "Labor",
      desc: "Senior accessibility engineer (1,040 hrs)",
      qty: 1040,
      rate: "$165.00",
      ext: "$171,600.00"
    }, {
      cost: "Labor",
      desc: "UX designer — remediation & testing (480 hrs)",
      qty: 480,
      rate: "$135.00",
      ext: "$64,800.00"
    }, {
      cost: "Material",
      desc: "Automated audit tooling licenses",
      qty: 4,
      rate: "$2,000.00",
      ext: "$8,000.00"
    }, {
      cost: "Travel",
      desc: "On-site validation sessions",
      qty: 1,
      rate: "$4,100.00",
      ext: "$4,100.00"
    }]
  },
  // ---- Vendor: my subcontracts ----
  contracts: [{
    id: "c1",
    title: "Grants management web application",
    contractType: "FFP",
    value: "$214,000.00",
    status: "Active",
    esign: "Signed"
  }, {
    id: "c2",
    title: "Case management API integration",
    contractType: "T&M",
    value: "$98,750.00",
    status: "Awarded",
    esign: "Awaiting signature"
  }],
  // ---- Vendor: compliance documents ----
  documents: [{
    name: "W-9 (2026).pdf",
    type: "Tax",
    status: "Verified",
    tone: "success"
  }, {
    name: "Certificate of Insurance.pdf",
    type: "Insurance",
    status: "Verified",
    tone: "success"
  }, {
    name: "Capability statement.pdf",
    type: "Capability",
    status: "Scanning",
    tone: "info"
  }, {
    name: "Past performance — VA.pdf",
    type: "Reference",
    status: "Action needed",
    tone: "warn"
  }],
  // ---- Split-view approval detail (release gate) ----
  approvalDetail: {
    title: "Section 508 audit & accessible UI remediation",
    notice: "36C10B26R0042",
    agency: "Dept. of Veterans Affairs",
    feasibility: 81,
    sourceLines: ["1.0 The contractor shall conduct a full Section 508 conformance audit of the claims portal.", "2.1 Remediation of all Level A and AA failures per WCAG 2.1 is required.", "2.2 Automated and manual testing artifacts shall be delivered.", "3.0 Period of performance: 12 months from award.", "4.1 Key personnel must include a certified accessibility specialist."],
    evalLines: [{
      item: "Conformance audit",
      markup: "Standard",
      vendor: "Meridian Federal",
      flag: false
    }, {
      item: "WCAG 2.1 AA remediation",
      markup: "Standard",
      vendor: "Meridian Federal",
      flag: false
    }, {
      item: "Testing artifacts",
      markup: "Standard",
      vendor: "Anchor Data Systems",
      flag: false
    }, {
      item: "Certified specialist (key personnel)",
      markup: "Review",
      vendor: "Low confidence — confirm cert",
      flag: true
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "design_handoff_console_backend_wiring/console/data.js", error: String((e && e.message) || e) }); }

// ui_kits/console/console-auth.jsx
try { (() => {
// Console UI kit — shared chrome (nav, page header, icons, theme) + auth screens.
const {
  Brand,
  Button,
  Field,
  Badge,
  Alert
} = window.BurgerGovDesignSystem_d0c3b4;
const C = window.CONSOLE;
function SunIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  }));
}
function MoonIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  }));
}
function ThemeBtn({
  theme,
  toggleTheme
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "iconBtn",
    onClick: toggleTheme,
    "aria-label": "Toggle theme"
  }, theme === "command" ? /*#__PURE__*/React.createElement(SunIcon, null) : /*#__PURE__*/React.createElement(MoonIcon, null));
}
function AppNav({
  surface,
  route,
  go,
  theme,
  toggleTheme
}) {
  const links = surface === "admin" ? [{
    k: "admin",
    label: "Console"
  }, {
    k: "solicitations",
    label: "Solicitations"
  }, {
    k: "approvals",
    label: "Approvals"
  }, {
    k: "prospects",
    label: "Prospects"
  }, {
    k: "vendors",
    label: "Vendors"
  }, {
    k: "inquiries",
    label: "Inquiries"
  }] : [{
    k: "vendor",
    label: "Dashboard"
  }, {
    k: "rfqs",
    label: "Open RFQs"
  }, {
    k: "quotes",
    label: "My Quotes"
  }, {
    k: "contracts",
    label: "Subcontracts"
  }, {
    k: "documents",
    label: "Documents"
  }];
  // sub-routes that should highlight a parent nav item
  const activeFor = {
    "solicitation-detail": "solicitations",
    "proposal": "solicitations",
    "approval-detail": "approvals",
    "quote-submit": "rfqs",
    "quote": "quotes"
  };
  const activeKey = activeFor[route] || route;
  return /*#__PURE__*/React.createElement("header", {
    className: "navHeader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "navInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    onClick: () => go(surface === "admin" ? "admin" : "vendor")
  }, /*#__PURE__*/React.createElement(Brand, null)), /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, surface === "admin" ? "Admin · HITL" : "Subcontractor"), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, links.map(l => /*#__PURE__*/React.createElement("button", {
    key: l.k,
    className: "navLink" + (activeKey === l.k ? " active" : ""),
    onClick: () => go(l.k)
  }, l.label))), /*#__PURE__*/React.createElement("span", {
    className: "navSpacer"
  }), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  }), /*#__PURE__*/React.createElement("span", {
    className: "role"
  }, surface === "admin" ? C.operator : C.vendorName), /*#__PURE__*/React.createElement("button", {
    className: "signout",
    onClick: () => go(surface === "admin" ? "admin-login" : "vendor-login")
  }, "Sign out")));
}
function PageHeader({
  title,
  lede,
  actions,
  back
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "pageHeader"
  }, back ? /*#__PURE__*/React.createElement("div", {
    className: "pageBack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: back.onClick
  }, "\u2190 ", back.label)) : null, /*#__PURE__*/React.createElement("div", {
    className: "pageRow"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "pageTitle"
  }, title), actions ? /*#__PURE__*/React.createElement("div", {
    className: "pageActions"
  }, actions) : null), lede ? /*#__PURE__*/React.createElement("p", {
    className: "pageLede"
  }, lede) : null);
}

// Split auth screen (shared by both surfaces).
function AuthScreen({
  kind,
  go,
  theme,
  toggleTheme
}) {
  const admin = kind === "admin";
  const quote = admin ? "Nothing is sent or advanced without your explicit approval." : "Review open RFQs, prepare quotes, and submit — all from one secure workspace.";
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, quote), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, admin ? "Human-in-the-loop console" : "Subcontractor portal"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, admin ? "Admin access · TOTP required" : "Vendor access"), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, admin ? "Console sign-in" : "Subcontractor sign-in"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, admin ? "Operator credentials, then a one-time passcode." : "Access open RFQs, your quotes, and compliance documents."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      go(admin ? "admin-totp" : "vendor");
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    name: "email",
    type: "email",
    defaultValue: admin ? "t.burger@burgergov.com" : "bids@meridianfederal.com",
    autoComplete: "username"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Password",
    name: "password",
    type: "password",
    defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    autoComplete: "current-password"
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    block: true
  }, admin ? "Continue" : "Sign in")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, admin ? /*#__PURE__*/React.createElement(React.Fragment, null, "Subcontractor? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("vendor-login")
  }, "Vendor sign-in \u2192")) : /*#__PURE__*/React.createElement(React.Fragment, null, "Firm operator? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("admin-login")
  }, "Admin sign-in \u2192"))), !admin ? /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "First time, with an invitation link? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("invite-onboard")
  }, "Set up your account \u2192")) : null, /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, "\u2190 Back to burgergov.com")))));
}
function TotpScreen({
  go,
  theme,
  toggleTheme
}) {
  const [vals, setVals] = React.useState(["", "", "", "", "", ""]);
  const refs = React.useRef([]);
  function set(i, v) {
    if (!/^[0-9a-zA-Z]?$/.test(v)) return;
    const next = vals.slice();
    next[i] = v.slice(-1);
    setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every(x => x)) setTimeout(() => go("admin"), 350);
  }
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, "Zero-trust access. Six characters stand between intent and the console."), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, "TOTP verification"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, "Step 2 \xB7 One-time passcode"), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, "Enter your code"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, "From your authenticator app. The form submits on the final character."), /*#__PURE__*/React.createElement("div", {
    className: "totpRow"
  }, vals.map((v, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    ref: el => refs.current[i] = el,
    className: "totpCell",
    inputMode: "text",
    maxLength: 1,
    value: v,
    onChange: e => set(i, e.target.value),
    "aria-label": `Digit ${i + 1}`
  }))), /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => go("admin")
  }, "Verify"), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "First time? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("admin-enroll")
  }, "Set up two-factor \u2192")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("admin-login")
  }, "\u2190 Back")))));
}

// Invited-vendor onboarding — the /invite/[token] screen (set a password, once).
function InviteOnboard({
  go,
  theme,
  toggleTheme
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, "You were invited directly. This secure link sets up your account \u2014 there is no public sign-up."), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, "Single-use onboarding link"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, "Invitation \xB7 ", C.vendorName), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, "Set up your account"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, "Confirm your email and choose a password. After this, sign in anytime with your email and password."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      go("vendor");
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    name: "email",
    type: "email",
    defaultValue: C.vendorEmail,
    readOnly: true,
    "aria-readonly": "true"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Password (at least 12 characters)",
    name: "password",
    type: "password",
    defaultValue: "",
    autoComplete: "new-password"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Confirm password",
    name: "confirmPassword",
    type: "password",
    defaultValue: "",
    autoComplete: "new-password"
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    block: true
  }, "Create account")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "Already set up? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("vendor-login")
  }, "Sign in \u2192")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, "\u2190 Back to burgergov.com")))));
}

// Decorative QR matrix (demo — not scannable). Deterministic pattern + finder squares.
function FakeQR({
  seed
}) {
  const N = 25;
  const cells = [];
  // simple deterministic PRNG from a string seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) % 1000 / 1000;
  };
  const inFinder = (r, c) => {
    const f = (br, bc) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return f(0, 0) || f(0, N - 7) || f(N - 7, 0);
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (inFinder(r, c)) continue;
    if (rand() > 0.55) cells.push(/*#__PURE__*/React.createElement("rect", {
      key: r + "-" + c,
      x: c,
      y: r,
      width: "1",
      height: "1"
    }));
  }
  function Finder({
    x,
    y
  }) {
    return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: "7",
      height: "7",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: x + 2,
      y: y + 2,
      width: "3",
      height: "3"
    }));
  }
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `-1 -1 ${N + 2} ${N + 2}`,
    width: "180",
    height: "180",
    fill: "currentColor",
    shapeRendering: "crispEdges",
    role: "img",
    "aria-label": "Authenticator enrollment QR code (demo)"
  }, cells, /*#__PURE__*/React.createElement(Finder, {
    x: 0,
    y: 0
  }), /*#__PURE__*/React.createElement(Finder, {
    x: N - 7,
    y: 0
  }), /*#__PURE__*/React.createElement(Finder, {
    x: 0,
    y: N - 7
  }));
}

// First-time admin TOTP enrollment — QR + manual key + confirm code.
function EnrollScreen({
  go,
  theme,
  toggleTheme
}) {
  const KEY = "JBSWY3DPEHPK3PXP NK4F TZ2A QRST";
  const [vals, setVals] = React.useState(["", "", "", "", "", ""]);
  const refs = React.useRef([]);
  function set(i, v) {
    if (!/^[0-9]?$/.test(v)) return;
    const next = vals.slice();
    next[i] = v.slice(-1);
    setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every(x => x)) setTimeout(() => go("admin"), 350);
  }
  return /*#__PURE__*/React.createElement("main", {
    className: "authScreen"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "authAside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authAsideGrid",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "authAsideInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brandLink",
    title: "Back to burgergov.com",
    onClick: () => {
      window.location.href = "../marketing/index.html";
    }
  }, /*#__PURE__*/React.createElement(Brand, {
    size: "lg"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "authQuote"
  }, "Two factors, every session. The secret is yours alone \u2014 we store only its encrypted form."), /*#__PURE__*/React.createElement("div", {
    className: "authAsideMeta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "surfaceTag"
  }, "TOTP enrollment"))), /*#__PURE__*/React.createElement("section", {
    className: "authMain"
  }, /*#__PURE__*/React.createElement("div", {
    className: "authCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "authBadge"
  }, "Step 1 \xB7 Set up 2FA"), /*#__PURE__*/React.createElement(ThemeBtn, {
    theme: theme,
    toggleTheme: toggleTheme
  })), /*#__PURE__*/React.createElement("h1", {
    className: "authTitle"
  }, "Set up two-factor authentication"), /*#__PURE__*/React.createElement("p", {
    className: "authSubtitle"
  }, "Scan this QR code with your authenticator app, then enter the current code to confirm."), /*#__PURE__*/React.createElement("div", {
    className: "qrFrame"
  }, /*#__PURE__*/React.createElement(FakeQR, {
    seed: C.operator
  })), /*#__PURE__*/React.createElement("p", {
    className: "enrollKey"
  }, "Or enter this key manually:", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", {
    className: "code"
  }, KEY)), /*#__PURE__*/React.createElement("p", {
    className: "formLabel",
    style: {
      marginTop: "var(--space-4)"
    }
  }, "Confirmation code"), /*#__PURE__*/React.createElement("div", {
    className: "totpRow"
  }, vals.map((v, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    ref: el => refs.current[i] = el,
    className: "totpCell",
    inputMode: "numeric",
    maxLength: 1,
    value: v,
    onChange: e => set(i, e.target.value),
    "aria-label": `Digit ${i + 1}`
  }))), /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => go("admin")
  }, "Confirm"), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, "Already enrolled? ", /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("admin-totp")
  }, "Enter your code \u2192")), /*#__PURE__*/React.createElement("p", {
    className: "authSwitch"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("admin-login")
  }, "\u2190 Back")))));
}
window.ConsoleAuth = {
  AppNav,
  PageHeader,
  AuthScreen,
  TotpScreen,
  InviteOnboard,
  EnrollScreen,
  ThemeBtn
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/console-auth.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/console-views-admin.jsx
try { (() => {
// Console UI kit — ADMIN surface views (the full operator pipeline).
const {
  Badge,
  Button,
  Field
} = window.BurgerGovDesignSystem_d0c3b4;
const CON = window.CONSOLE;
const {
  PageHeader
} = window.ConsoleAuth;
function StatGrid({
  stats
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "statGrid"
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "stat" + (s.tone === "warn" ? " warn" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "statValue"
  }, s.value), /*#__PURE__*/React.createElement("div", {
    className: "statLabel"
  }, s.label))));
}

/* ---------- MORNING BRIEF ---------- */
function AdminHome({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Morning brief",
    lede: "Everything awaiting a human decision, as of 06:00 EDT. Rendering this page never advances any state."
  }), /*#__PURE__*/React.createElement(StatGrid, {
    stats: CON.brief.stats
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Awaiting a sourcing decision ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.triaged.length, ")")), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("solicitations")
  }, "Open board \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.triaged.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("solicitation-detail")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency, " \xB7 fit ", s.fit)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scoreBar",
    title: "feasibility " + s.feasibility
  }, /*#__PURE__*/React.createElement("div", {
    className: "scoreFill",
    style: {
      width: s.feasibility + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, s.feasibility))))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "New contact inquiries"), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("inquiries")
  }, "Open inbox \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.inquiries.filter(i => i.status === "NEW").map(i => /*#__PURE__*/React.createElement("li", {
    key: i.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("inquiries")
  }, i.company), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, i.name, " \xB7 ", i.intent)), /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "new")))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Response deadlines within 72h ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.deadlines.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.deadlines.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", null, s.title), /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "due ", s.due)))))));
}

/* ---------- SOLICITATIONS KANBAN ---------- */
function SolicitationsBoard({
  go,
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Solicitations",
    lede: "Sourced from SAM.gov and triaged by the AI \u2014 a recommendation only. You decide what advances; rendering the board sends nothing."
  }), /*#__PURE__*/React.createElement("div", {
    className: "kanban"
  }, CON.board.map(col => /*#__PURE__*/React.createElement("section", {
    key: col.title,
    className: "column"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "columnHead"
  }, col.title, " ", /*#__PURE__*/React.createElement("span", {
    className: "columnCount"
  }, "(", col.items.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "columnCards"
  }, col.items.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "empty"
  }, "\u2014") : col.items.map(s => /*#__PURE__*/React.createElement("article", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("solicitation-detail")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginTop: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(Badge, null, s.status), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, "feas ", s.feasibility, " \xB7 fit ", s.fit)), s.gate ? /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginTop: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct("Sourcing approved — outreach drafting queued for your review.")
  }, "Approve sourcing"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct("Marked no-go — solicitation archived.")
  }, "No-go")) : null)))))));
}

/* ---------- SOLICITATION DETAIL (ranked quotes) ---------- */
function SolicitationDetail({
  go,
  onAct
}) {
  const d = CON.solicitationDetail;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: d.title,
    lede: `${d.agency} · ${d.status} · due ${d.deadline}`,
    back: {
      label: "Solicitations",
      onClick: () => go("solicitations")
    },
    actions: /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "feasibility ", d.feasibility), /*#__PURE__*/React.createElement(Badge, null, d.contractType))
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Triage recommendation"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      marginBottom: "var(--space-3)"
    }
  }, "Notice ", d.notice, " \xB7 NAICS ", d.naics, " \xB7 fit ", d.fit), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--studio-ink)",
      lineHeight: 1.6
    }
  }, d.scope), d.concerns.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Flagged concerns"), /*#__PURE__*/React.createElement("ul", {
    className: "bulletList"
  }, d.concerns.map((c, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, c)))) : null)), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Subcontractor quotes \u2014 AI-ranked ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", d.quotes.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, d.quotes.map(q => /*#__PURE__*/React.createElement("li", {
    key: q.id,
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rankPill"
  }, "#", q.rank), /*#__PURE__*/React.createElement("strong", null, q.vendor)), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, q.status, " \xB7 ", q.total)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct(`${q.vendor} shortlisted.`)
  }, "Shortlist"), q.rank === 1 ? /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct(`${q.vendor} selected as winner — priced bid draft will be generated for your review.`)
  }, "Select winner") : null)), /*#__PURE__*/React.createElement("div", {
    className: "rationale"
  }, q.rationale)))), /*#__PURE__*/React.createElement("p", {
    className: "meta"
  }, "Selecting a winner records your choice; the priced bid draft is generated for review in the next step \u2014 nothing is submitted to the government automatically."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("proposal")
  }, "\u2192 Review the priced bid decision-brief"))));
}

/* ---------- PROPOSAL DECISION-BRIEF ---------- */
function ChecklistRows({
  items
}) {
  return /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, items.map((ci, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "row",
    style: {
      gap: "var(--space-3)",
      padding: "var(--space-2) 0"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: ci.passed ? "success" : "warn"
  }, ci.passed ? "PASS" : "REVIEW"), /*#__PURE__*/React.createElement("span", null, ci.item, ci.note ? ` — ${ci.note}` : ""))));
}
function ProposalBrief({
  go,
  onAct
}) {
  const p = CON.proposal;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Bid decision-brief",
    lede: `${p.title} · status ${p.status} · ${p.contractType}${p.provisional ? " · PROVISIONAL (dry-run baseline)" : ""}`,
    back: {
      label: "Solicitation",
      onClick: () => go("solicitation-detail")
    }
  }), p.watermark ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, p.watermark)) : null, /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Pricing scenarios ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", p.scenarios.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Scenario"), /*#__PURE__*/React.createElement("th", null, "Price"), /*#__PURE__*/React.createElement("th", null, "Fee %"), /*#__PURE__*/React.createElement("th", null, "Margin %"), /*#__PURE__*/React.createElement("th", null, "vs. benchmark median"))), /*#__PURE__*/React.createElement("tbody", null, p.scenarios.map((s, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, s.label), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.price), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.feePct), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.marginPct), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.vsBench)))))), /*#__PURE__*/React.createElement("p", {
    className: "meta"
  }, "Scenarios are a decision aid \u2014 you choose the number; the system never picks one.")), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Compliance checklist"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(ChecklistRows, {
    items: p.compliance
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Bid checklist"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(ChecklistRows, {
    items: p.bidChecklist
  })))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Live-submission blockers"), /*#__PURE__*/React.createElement("div", {
    className: "card blockerCard"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 0
    }
  }, "This bid ", /*#__PURE__*/React.createElement("strong", null, "cannot"), " be submitted yet. The following must be resolved before any real bid leaves the building:"), /*#__PURE__*/React.createElement("ul", {
    className: "bulletList"
  }, p.blockers.map((b, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, b))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Review workflow"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Draft \u2192 Counsel review \u2192 Ready to submit \u2192 Submit"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "Each transition is a separate human action. Submission stays blocked while any live gate fails.")), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct("Counsel review recorded.")
  }, "Record counsel review"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    disabled: true,
    title: "Blocked by live-submission gates"
  }, "Mark ready"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    disabled: true,
    title: "Blocked by live-submission gates"
  }, "Submit to agency"))))));
}

/* ---------- APPROVALS ---------- */
function ApprovalsView({
  go,
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Approvals",
    lede: "Each button is the only emitter of a human-gate event. Nothing is sent or advanced without your explicit approval.",
    back: {
      label: "Console",
      onClick: () => go("admin")
    }
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Solicitations awaiting a sourcing decision ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.triaged.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.triaged.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("approval-detail")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency, " \xB7 feasibility ", s.feasibility, " \xB7 fit ", s.fit)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => go("approval-detail")
  }, "Open split-view"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct("Sourcing approved — outreach drafting queued.")
  }, "Approve sourcing"))))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Outreach awaiting approval ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.outreach.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.outreach.map(o => /*#__PURE__*/React.createElement("li", {
    key: o.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, o.subject), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, "to ", o.prospect)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct("Outreach approved & sent.")
  }, "Approve & send"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => onAct("Outreach rejected.")
  }, "Reject"))))))));
}

// Long-press release gate — hold 1.5s to dispatch; release early resets.
function ReleaseGate({
  onComplete
}) {
  const [pct, setPct] = React.useState(0);
  const raf = React.useRef(null);
  const start = React.useRef(0);
  const done = React.useRef(false);
  const DUR = 1500;
  function begin() {
    done.current = false;
    start.current = performance.now();
    const step = t => {
      const p = Math.min(100, (t - start.current) / DUR * 100);
      setPct(p);
      if (p >= 100) {
        done.current = true;
        onComplete();
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }
  function end() {
    cancelAnimationFrame(raf.current);
    if (!done.current) setPct(0);
  }
  return /*#__PURE__*/React.createElement("button", {
    className: "gateBtn",
    onMouseDown: begin,
    onMouseUp: end,
    onMouseLeave: end,
    onTouchStart: begin,
    onTouchEnd: end
  }, /*#__PURE__*/React.createElement("span", {
    className: "gateFill",
    style: {
      width: pct + "%"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "gateLabel"
  }, pct >= 100 ? "Dispatched ✓" : "Hold to release bid"));
}
function ApprovalDetail({
  go,
  onAct
}) {
  const d = CON.approvalDetail;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: d.title,
    lede: `${d.agency} · Notice ${d.notice}`,
    back: {
      label: "Approvals",
      onClick: () => go("approvals")
    },
    actions: /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "feasibility ", d.feasibility)
  }), /*#__PURE__*/React.createElement("div", {
    className: "split",
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("span", {
    className: "paneLabel"
  }, "Source solicitation \xB7 locked"), d.sourceLines.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "docLine"
  }, l))), /*#__PURE__*/React.createElement("div", {
    className: "pane"
  }, /*#__PURE__*/React.createElement("span", {
    className: "paneLabel"
  }, "AI evaluation \xB7 editable"), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap",
    style: {
      border: "none",
      boxShadow: "none",
      background: "transparent"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Line item"), /*#__PURE__*/React.createElement("th", null, "Markup"), /*#__PURE__*/React.createElement("th", null, "Vendor / note"))), /*#__PURE__*/React.createElement("tbody", null, d.evalLines.map((e, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, e.item), /*#__PURE__*/React.createElement("td", null, e.flag ? /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, e.markup) : /*#__PURE__*/React.createElement(Badge, null, e.markup)), /*#__PURE__*/React.createElement("td", {
    className: e.flag ? "docLine flag" : "",
    style: {
      border: "none",
      padding: 0
    }
  }, e.vendor)))))))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Dispatch the assembled bid to the client"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "Press and hold to confirm \u2014 this prevents accidental release.")), /*#__PURE__*/React.createElement(ReleaseGate, {
    onComplete: () => onAct("Bid dispatched — row locked. Payload sent to client.")
  }))));
}

/* ---------- INQUIRIES INBOX ---------- */
function InquiriesView({
  onAct
}) {
  const newCount = CON.inquiries.filter(i => i.status === "NEW").length;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Contact inquiries",
    lede: `${CON.inquiries.length} total · ${newCount} new. Submitted from the public site; visitor text is shown as data, never executed.`
  }), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.inquiries.map(i => /*#__PURE__*/React.createElement("li", {
    key: i.id,
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, i.name), " \xB7 ", i.email, /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, i.company)), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, i.intent), /*#__PURE__*/React.createElement(Badge, {
    tone: i.status === "NEW" ? "warn" : "neutral"
  }, i.status), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, i.date))), /*#__PURE__*/React.createElement("blockquote", {
    className: "inquiryQuote"
  }, i.message), i.status === "NEW" ? /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => onAct("Inquiry marked reviewed.")
  }, "Mark reviewed") : null))));
}

/* ---------- PROSPECTS ---------- */
function ProspectsView({
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Prospects",
    lede: "Subcontractor candidates from AI discovery and inbound inquiries. Qualifying a prospect makes it promotable to a vetted vendor."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Add a prospect"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formGrid"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Company",
    name: "companyName",
    placeholder: "Acme Federal LLC"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    name: "contactEmail",
    type: "email",
    placeholder: "bids@acme.com"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "NAICS",
    name: "naics",
    placeholder: "541511, 541512"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Capabilities",
    name: "capabilities",
    placeholder: "Accessible UI, PostgreSQL\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => onAct("Prospect added.")
  }, "Add prospect")))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "All prospects ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", CON.prospects.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, CON.prospects.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, p.company), " \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, p.email), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      marginTop: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: p.status === "Qualified" ? "success" : "neutral"
  }, p.status), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, p.source), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, "NAICS ", p.naics, " \xB7 score ", p.score))), p.status !== "Qualified" ? /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => onAct(`${p.company} marked qualified.`)
  }, "Mark qualified") : null))))));
}

/* ---------- VENDORS (promote / vet / link / invite) ---------- */
function VendorsView({
  onAct
}) {
  const v = CON.vendors;
  const [copied, setCopied] = React.useState(false);
  function copy() {
    setCopied(true);
    onAct("Single-use onboarding link generated — copy it and send it to the vendor yourself.");
    if (navigator.clipboard) navigator.clipboard.writeText(v.inviteLink).catch(() => {});
    setTimeout(() => setCopied(false), 2500);
  }
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Vendors",
    lede: "Promote qualified prospects, vet vendors, link vendor users, and generate single-use onboarding invitations. The app never emails on its own \u2014 you send the link."
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Qualified prospects ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", v.qualifiedProspects.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, v.qualifiedProspects.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("strong", null, p.company), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct(`${p.company} promoted to vendor (pending vetting).`)
  }, "Promote to vendor")))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Vendors awaiting vetting ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", v.pendingVendors.length, ")")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, v.pendingVendors.map(x => /*#__PURE__*/React.createElement("li", {
    key: x.id,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("strong", null, x.company), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onAct(`${x.company} marked vetted.`)
  }, "Mark vetted")))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Link a vendor user"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginTop: 0
    }
  }, "Binding a VENDOR-role user to a vetted vendor is admin-only \u2014 never self-asserted."), /*#__PURE__*/React.createElement("div", {
    className: "formGrid"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "User",
    name: "userId",
    placeholder: "ops@cobaltcivic.com"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Vendor",
    name: "vendorId",
    placeholder: "Cobalt Civic Tech"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => onAct("Vendor user linked.")
  }, "Link")))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Invite a vendor user"), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginTop: 0
    }
  }, "Generates a single-use onboarding link tied to one vetted vendor. Copy it and send it to the vendor yourself."), /*#__PURE__*/React.createElement("div", {
    className: "formGrid"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Vendor",
    name: "inviteVendor",
    placeholder: "Meridian Federal LLC"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Invitee email",
    name: "inviteEmail",
    type: "email",
    placeholder: "bids@meridianfederal.com"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-4)"
    },
    className: "row"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: copy
  }, copied ? "Copied ✓" : "Generate & copy link")), copied ? /*#__PURE__*/React.createElement("div", {
    className: "inviteLink"
  }, v.inviteLink) : null)));
}
window.ConsoleAdmin = {
  AdminHome,
  SolicitationsBoard,
  SolicitationDetail,
  ProposalBrief,
  ApprovalsView,
  ApprovalDetail,
  InquiriesView,
  ProspectsView,
  VendorsView,
  StatGrid
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/console-views-admin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/console-views-vendor.jsx
try { (() => {
// Console UI kit — VENDOR (subcontractor) surface views.
const {
  Badge: VBadge,
  Button: VButton,
  Field: VField
} = window.BurgerGovDesignSystem_d0c3b4;
const VCON = window.CONSOLE;
const {
  PageHeader: VPageHeader
} = window.ConsoleAuth;
const {
  StatGrid: VStatGrid
} = window.ConsoleAdmin;

/* ---------- DASHBOARD ---------- */
function VendorHome({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Subcontractor dashboard",
    lede: `Welcome back, ${VCON.vendorName}. Here's what needs your attention.`
  }), /*#__PURE__*/React.createElement(VStatGrid, {
    stats: VCON.vendorStats
  }), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Open RFQs ", /*#__PURE__*/React.createElement("span", {
    className: "sectionCount"
  }, "(", VCON.rfqs.length, ")")), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("rfqs")
  }, "View all \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, VCON.rfqs.slice(0, 2).map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote-submit")
  }, s.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono"
  }, s.agency, " \xB7 NAICS ", s.naics)), /*#__PURE__*/React.createElement("span", {
    className: "metaMono"
  }, "due ", s.deadline)))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "My quotes"), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("quotes")
  }, "View all \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, VCON.myQuotes.map(q => /*#__PURE__*/React.createElement("li", {
    key: q.id,
    className: "card cardSm hoverable"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote")
  }, q.title), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tableNum"
  }, q.total), /*#__PURE__*/React.createElement(VBadge, {
    tone: q.status === "Submitted" ? "success" : "info"
  }, q.status))))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sectionHead"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Compliance documents"), /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => go("documents")
  }, "Manage \u2192")), /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, VCON.documents.slice(0, 3).map((d, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "card cardSm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "metaMono",
    style: {
      color: "var(--studio-ink)"
    }
  }, d.name), /*#__PURE__*/React.createElement(VBadge, {
    tone: d.tone
  }, d.status)))))));
}

/* ---------- OPEN RFQS ---------- */
function RfqsView({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Open RFQs",
    lede: "Solicitations the firm is currently sourcing subcontractor quotes for."
  }), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Title"), /*#__PURE__*/React.createElement("th", null, "Agency"), /*#__PURE__*/React.createElement("th", null, "NAICS"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Response deadline"), /*#__PURE__*/React.createElement("th", null, "Action"))), /*#__PURE__*/React.createElement("tbody", null, VCON.rfqs.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id
  }, /*#__PURE__*/React.createElement("td", null, s.title), /*#__PURE__*/React.createElement("td", null, s.agency), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.naics), /*#__PURE__*/React.createElement("td", null, s.contractType), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, s.deadline), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote-submit")
  }, "Submit quote"))))))));
}

/* ---------- QUOTE SUBMISSION FORM ---------- */
function QuoteSubmitView({
  go,
  onAct
}) {
  const t = VCON.quoteTarget;
  const ROWS = [0, 1, 2];
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Submit a quote",
    lede: "Enter your line items, terms, and upload your quote document. Nothing is shared with other subcontractors.",
    back: {
      label: "Open RFQs",
      onClick: () => go("rfqs")
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      margin: 0
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      margin: "var(--space-2) 0"
    }
  }, t.agency, " \xB7 Notice ", t.notice, " \xB7 ", t.contractType, " \xB7 due ", t.deadline), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--studio-ink)",
      lineHeight: 1.6
    }
  }, t.scope)), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Line items"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: "var(--space-6)"
    }
  }, ROWS.map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "lineRow"
  }, /*#__PURE__*/React.createElement("select", {
    className: "lineSelect",
    "aria-label": `Cost type ${i + 1}`,
    defaultValue: "Labor"
  }, t.costTypes.map(ct => /*#__PURE__*/React.createElement("option", {
    key: ct,
    value: ct
  }, ct))), /*#__PURE__*/React.createElement("input", {
    className: "lineInput",
    placeholder: "Description",
    "aria-label": `Description ${i + 1}`
  }), /*#__PURE__*/React.createElement("input", {
    className: "lineInput",
    type: "number",
    placeholder: "Qty",
    defaultValue: "1",
    "aria-label": `Quantity ${i + 1}`
  }), /*#__PURE__*/React.createElement("input", {
    className: "lineInput",
    type: "number",
    placeholder: "Unit rate (USD)",
    "aria-label": `Unit rate ${i + 1}`
  }))), /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      marginBottom: 0
    }
  }, "Enter at least one line item. Leave unused rows blank.")), /*#__PURE__*/React.createElement("div", {
    className: "formGrid",
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(VField, {
    label: "Period of performance",
    name: "pop",
    placeholder: "e.g. 12 months"
  }), /*#__PURE__*/React.createElement("label", {
    className: "checkRow"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    defaultChecked: true
  }), " Pay-when-paid terms acceptable")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "formLabel"
  }, "Notes"), /*#__PURE__*/React.createElement("textarea", {
    className: "lineInput",
    rows: 4,
    placeholder: "Anything the firm should know about your quote\u2026",
    style: {
      width: "100%",
      resize: "vertical"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "card uploadZone",
    onClick: () => onAct("File attached — quote_meridian.pdf (validated)."),
    style: {
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      color: "var(--studio-primary)",
      fontSize: "1.4rem"
    }
  }, "\u2B06"), /*#__PURE__*/React.createElement("strong", null, "Quote document (PDF or DOCX, max 25 MB)"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "Magic-byte validated \xB7 signed-URL upload")), /*#__PURE__*/React.createElement(VButton, {
    onClick: () => onAct("Quote submitted for review. No further action needed.")
  }, "Submit quote"));
}

/* ---------- MY QUOTES ---------- */
function MyQuotesView({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "My quotes",
    lede: "Quotes you've submitted, with their current review status."
  }), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Solicitation"), /*#__PURE__*/React.createElement("th", null, "Agency"), /*#__PURE__*/React.createElement("th", null, "Total"), /*#__PURE__*/React.createElement("th", null, "Submitted"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, VCON.myQuotes.map(q => /*#__PURE__*/React.createElement("tr", {
    key: q.id
  }, /*#__PURE__*/React.createElement("td", null, q.title), /*#__PURE__*/React.createElement("td", null, q.agency), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, q.total), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, q.date), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: q.status === "Submitted" ? "success" : "info"
  }, q.status)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "linkish",
    onClick: () => go("quote")
  }, "View \u2192"))))))));
}

/* ---------- QUOTE DETAIL ---------- */
function QuoteView({
  go
}) {
  const q = VCON.quote;
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: q.title,
    lede: `Notice ${q.notice}`,
    back: {
      label: "My quotes",
      onClick: () => go("quotes")
    },
    actions: /*#__PURE__*/React.createElement(VBadge, {
      tone: "success"
    }, q.status)
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("ul", {
    className: "list"
  }, /*#__PURE__*/React.createElement("li", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Total price"), /*#__PURE__*/React.createElement("span", {
    className: "tableNum",
    style: {
      fontSize: "1.1rem"
    }
  }, q.total)), /*#__PURE__*/React.createElement("li", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Period of performance"), /*#__PURE__*/React.createElement("span", null, q.pop)), /*#__PURE__*/React.createElement("li", {
    className: "rowBetween"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta"
  }, "Pay-when-paid"), /*#__PURE__*/React.createElement("span", null, q.payWhenPaid ? "Yes" : "No")))), q.notes ? /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-3)"
    }
  }, "Notes"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--studio-ink)",
      lineHeight: 1.6
    }
  }, q.notes)) : null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-4)"
    }
  }, "Line items"), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Cost type"), /*#__PURE__*/React.createElement("th", null, "Description"), /*#__PURE__*/React.createElement("th", null, "Qty"), /*#__PURE__*/React.createElement("th", null, "Unit rate"), /*#__PURE__*/React.createElement("th", null, "Extended"))), /*#__PURE__*/React.createElement("tbody", null, q.lines.map((l, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, l.cost), /*#__PURE__*/React.createElement("td", null, l.desc), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, l.qty), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, l.rate), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, l.ext)))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", {
    className: "tfoot"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: 4
  }, "Total"), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, q.total))))));
}

/* ---------- MY SUBCONTRACTS ---------- */
function ContractsView() {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "My subcontracts",
    lede: "Contracts awarded to you, with execution and e-signature status."
  }), VCON.contracts.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "empty"
  }, "You have no subcontracts yet.") : /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Solicitation"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Value"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "E-sign"))), /*#__PURE__*/React.createElement("tbody", null, VCON.contracts.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", null, r.title), /*#__PURE__*/React.createElement("td", null, r.contractType), /*#__PURE__*/React.createElement("td", {
    className: "tableNum"
  }, r.value), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: r.status === "Active" ? "success" : "info"
  }, r.status)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: r.esign === "Signed" ? "success" : "warn"
  }, r.esign))))))));
}

/* ---------- DOCUMENTS ---------- */
function DocumentsView({
  onAct
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(VPageHeader, {
    title: "Compliance documents",
    lede: "Drop a document to begin validation. Background workers scan and verify each file."
  }), /*#__PURE__*/React.createElement("div", {
    className: "card uploadZone",
    onClick: () => onAct("Upload started — scanning Past performance — VA.pdf…"),
    style: {
      marginBottom: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "metaMono",
    style: {
      color: "var(--studio-primary)",
      fontSize: "1.5rem",
      marginBottom: "0.5rem"
    }
  }, "\u2B06"), /*#__PURE__*/React.createElement("strong", null, "Drop a compliance document here"), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, "PDF \xB7 magic-byte validated \xB7 signed-URL upload")), /*#__PURE__*/React.createElement("div", {
    className: "tableWrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "File"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, VCON.documents.map((d, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "tableNum",
    style: {
      color: "var(--studio-ink)"
    }
  }, d.name), /*#__PURE__*/React.createElement("td", null, d.type), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(VBadge, {
    tone: d.tone
  }, d.status))))))));
}
window.ConsoleVendor = {
  VendorHome,
  RfqsView,
  QuoteSubmitView,
  MyQuotesView,
  QuoteView,
  ContractsView,
  DocumentsView
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/console-views-vendor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/data.js
try { (() => {
// Console UI kit data — the FULL operator + subcontractor workflow, end to end.
// Synthetic but shaped like the real hermes2 schema. Truthfulness contract preserved:
// nothing advances without an explicit human action; live submission is gated.
window.CONSOLE = {
  operator: "t.burger@burgergov.com",
  vendorName: "Meridian Federal LLC",
  vendorEmail: "bids@meridianfederal.com",
  // ---- Admin: morning brief ----
  brief: {
    stats: [{
      label: "Awaiting sourcing decision",
      value: 3,
      tone: "neutral"
    }, {
      label: "Outreach awaiting approval",
      value: 2,
      tone: "warn"
    }, {
      label: "In pricing / bid review",
      value: 2,
      tone: "neutral"
    }, {
      label: "Deadlines within 72h",
      value: 2,
      tone: "warn"
    }, {
      label: "New contact inquiries",
      value: 2,
      tone: "warn"
    }]
  },
  triaged: [{
    id: "s1",
    title: "Logistics scheduling system modernization",
    agency: "DLA Troop Support",
    feasibility: 88,
    fit: "High"
  }, {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    agency: "Dept. of Veterans Affairs",
    feasibility: 81,
    fit: "High"
  }, {
    id: "s3",
    title: "Records database migration to PostgreSQL",
    agency: "GSA FAS",
    feasibility: 74,
    fit: "Medium"
  }],
  outreach: [{
    id: "o1",
    subject: "Subcontractor capability — accessible UI remediation (VA)",
    prospect: "Meridian Federal LLC"
  }, {
    id: "o2",
    subject: "Teaming inquiry — PostgreSQL migration (GSA)",
    prospect: "Anchor Data Systems"
  }],
  pricing: [{
    id: "s4",
    title: "Cybersecurity dashboard build-out"
  }, {
    id: "s5",
    title: "Grants management web application"
  }],
  deadlines: [{
    id: "s1",
    title: "Logistics scheduling system modernization",
    due: "2026-06-22 17:00 EDT"
  }, {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    due: "2026-06-23 12:00 EDT"
  }],
  // ---- Admin: solicitations kanban (5 operator phases) ----
  board: [{
    title: "Triage",
    items: [{
      id: "s2",
      title: "Section 508 audit & accessible UI remediation",
      agency: "Dept. of Veterans Affairs",
      status: "Triage complete",
      feasibility: 81,
      fit: "High",
      gate: true
    }, {
      id: "s3",
      title: "Records database migration to PostgreSQL",
      agency: "GSA FAS",
      status: "Triage complete",
      feasibility: 74,
      fit: "Medium",
      gate: true
    }]
  }, {
    title: "Sourcing",
    items: [{
      id: "s1",
      title: "Logistics scheduling system modernization",
      agency: "DLA Troop Support",
      status: "Sourcing in progress",
      feasibility: 88,
      fit: "High"
    }]
  }, {
    title: "Pricing",
    items: [{
      id: "s4",
      title: "Cybersecurity dashboard build-out",
      agency: "DHS CISA",
      status: "Pricing pending",
      feasibility: 79,
      fit: "High"
    }]
  }, {
    title: "Proposal",
    items: [{
      id: "s5",
      title: "Grants management web application",
      agency: "HHS",
      status: "Proposal draft",
      feasibility: 83,
      fit: "High"
    }]
  }, {
    title: "Submitted",
    items: [{
      id: "s6",
      title: "Case management API integration",
      agency: "USDA",
      status: "Submitted",
      feasibility: 85,
      fit: "High"
    }]
  }],
  // ---- Admin: solicitation detail (triage + ranked quotes) ----
  solicitationDetail: {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    agency: "Dept. of Veterans Affairs",
    notice: "36C10B26R0042",
    status: "Sourcing in progress",
    deadline: "2026-06-23 12:00 EDT",
    feasibility: 81,
    fit: "High",
    contractType: "FFP",
    naics: "541511",
    concerns: ["Key personnel must include a certified accessibility specialist — confirm before award."],
    scope: "The contractor shall conduct a full Section 508 conformance audit of the VA claims portal, remediate all Level A and AA failures per WCAG 2.1, and deliver automated and manual testing artifacts. Period of performance: 12 months from award. Key personnel must include a certified accessibility specialist.",
    quotes: [{
      id: "q1",
      vendor: "Meridian Federal LLC",
      status: "Submitted",
      total: "$248,500.00",
      rank: 1,
      rationale: "Strongest accessibility past performance; certified specialist named. Pricing 4% below benchmark median."
    }, {
      id: "q2",
      vendor: "Anchor Data Systems",
      status: "Submitted",
      total: "$262,000.00",
      rank: 2,
      rationale: "Solid testing methodology; specialist certification not yet evidenced. Pricing at benchmark median."
    }, {
      id: "q3",
      vendor: "Cobalt Civic Tech",
      status: "Submitted",
      total: "$291,750.00",
      rank: 3,
      rationale: "Capable team; highest price and lighter 508-specific past performance."
    }]
  },
  // ---- Admin: priced bid decision-brief ----
  proposal: {
    title: "Section 508 audit & accessible UI remediation",
    status: "Draft",
    contractType: "FFP",
    provisional: true,
    watermark: "PROVISIONAL — dry-run baseline · not for submission",
    scenarios: [{
      label: "Conservative",
      price: "$268,200",
      feePct: "8.0%",
      marginPct: "11.4%",
      vsBench: "+2.1%"
    }, {
      label: "Target",
      price: "$261,000",
      feePct: "10.0%",
      marginPct: "13.8%",
      vsBench: "−0.6%"
    }, {
      label: "Aggressive",
      price: "$252,400",
      feePct: "12.5%",
      marginPct: "16.2%",
      vsBench: "−3.9%"
    }],
    compliance: [{
      item: "FAR 52.204-24 representation present",
      passed: true
    }, {
      item: "Section 508 VPAT attached",
      passed: true
    }, {
      item: "Key personnel resumes — certified specialist",
      passed: false,
      note: "Awaiting signed certification"
    }, {
      item: "SAM.gov registration active at submission",
      passed: true
    }],
    bidChecklist: [{
      item: "Technical volume assembled",
      passed: true
    }, {
      item: "Price volume reconciled to line items",
      passed: true
    }, {
      item: "Subcontractor teaming agreement executed",
      passed: false,
      note: "Pending counsel review"
    }, {
      item: "Representations & certifications complete",
      passed: true
    }],
    blockers: ["CAGE code not yet assigned (pending) — required for SAM submission.", "Subcontractor teaming agreement awaiting counsel signature.", "Certified accessibility specialist certification not yet on file."]
  },
  // ---- Admin: contact inquiries (from the marketing site) ----
  inquiries: [{
    id: "i1",
    name: "Dana Whitfield",
    email: "dwhitfield@primecontractor.com",
    company: "Atlas Integrated Systems (Prime)",
    intent: "Teaming",
    status: "NEW",
    date: "2026-06-19",
    message: "We're bidding a VA modernization vehicle and need a 541511 partner with Section 508 depth. Are you available to discuss a teaming arrangement?"
  }, {
    id: "i2",
    name: "Capt. R. Alvarez",
    email: "r.alvarez@agency.gov",
    company: "DLA Troop Support",
    intent: "Capability",
    status: "NEW",
    date: "2026-06-18",
    message: "Requesting a capability statement for upcoming logistics scheduling modernization work under 541512."
  }, {
    id: "i3",
    name: "Priya Natarajan",
    email: "pnatarajan@anchordata.com",
    company: "Anchor Data Systems",
    intent: "Subcontractor",
    status: "Reviewed",
    date: "2026-06-15",
    message: "Interested in subcontracting on database migration efforts. PostgreSQL and accessibility experience available."
  }],
  // ---- Admin: prospects (discovery + qualify) ----
  prospects: [{
    id: "p1",
    company: "Meridian Federal LLC",
    email: "bids@meridianfederal.com",
    status: "Qualified",
    source: "AI discovery",
    score: 92,
    naics: "541511, 541512"
  }, {
    id: "p2",
    company: "Anchor Data Systems",
    email: "pnatarajan@anchordata.com",
    status: "Contacted",
    source: "Inbound inquiry",
    score: 84,
    naics: "541512"
  }, {
    id: "p3",
    company: "Cobalt Civic Tech",
    email: "team@cobaltcivic.com",
    status: "Discovered",
    source: "AI discovery",
    score: 77,
    naics: "541511, 541519"
  }, {
    id: "p4",
    company: "Northwind Systems Group",
    email: "rfp@northwindsg.com",
    status: "Discovered",
    source: "AI discovery",
    score: 71,
    naics: "541512"
  }],
  // ---- Admin: vendors (promote / vet / link / invite) ----
  vendors: {
    qualifiedProspects: [{
      id: "p1",
      company: "Meridian Federal LLC"
    }],
    pendingVendors: [{
      id: "v2",
      company: "Anchor Data Systems"
    }],
    vettedVendors: [{
      id: "v1",
      company: "Meridian Federal LLC"
    }, {
      id: "v3",
      company: "Cobalt Civic Tech"
    }],
    unlinkedUsers: [{
      id: "u2",
      email: "ops@cobaltcivic.com"
    }],
    inviteLink: "https://burgergov.com/invite/eyJhbGciOiJFUzI1Ni…s9-VENDOR_INVITE-single-use"
  },
  // ---- Vendor: dashboard ----
  vendorStats: [{
    label: "Open RFQs to bid",
    value: 3,
    tone: "neutral"
  }, {
    label: "Active quotes",
    value: 2,
    tone: "neutral"
  }, {
    label: "Awaiting your docs",
    value: 1,
    tone: "warn"
  }, {
    label: "Awarded YTD",
    value: 1,
    tone: "neutral"
  }],
  rfqs: [{
    id: "r1",
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    naics: "541511",
    deadline: "2026-06-30",
    contractType: "FFP"
  }, {
    id: "r2",
    title: "PostgreSQL records migration",
    agency: "GSA FAS",
    naics: "541512",
    deadline: "2026-07-08",
    contractType: "T&M"
  }, {
    id: "r3",
    title: "Logistics scheduling modernization",
    agency: "DLA Troop Support",
    naics: "541511",
    deadline: "2026-07-15",
    contractType: "FFP"
  }],
  // ---- Vendor: quote submission target (the form's solicitation) ----
  quoteTarget: {
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    notice: "SP4701-26-R-0042",
    contractType: "FFP",
    deadline: "2026-06-30",
    scope: "Remediate all Level A and AA Section 508 / WCAG 2.1 failures across the claims portal, deliver automated and manual testing artifacts, and provide a certified accessibility specialist as key personnel. Period of performance: 12 months.",
    costTypes: ["Labor", "Material", "ODC", "Subcontract", "Travel"]
  },
  // ---- Vendor: my quotes ----
  myQuotes: [{
    id: "mq1",
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    total: "$248,500.00",
    status: "Submitted",
    date: "2026-06-17"
  }, {
    id: "mq2",
    title: "PostgreSQL records migration",
    agency: "GSA FAS",
    total: "$176,300.00",
    status: "Under review",
    date: "2026-06-12"
  }],
  // ---- Vendor: single quote detail ----
  quote: {
    title: "Accessible UI remediation — claims portal",
    notice: "SP4701-26-R-0042",
    status: "Submitted",
    total: "$248,500.00",
    pop: "12 months",
    payWhenPaid: true,
    notes: "Certified accessibility specialist (IAAP CPACC) named as key personnel; resume attached.",
    lines: [{
      cost: "Labor",
      desc: "Senior accessibility engineer (1,040 hrs)",
      qty: 1040,
      rate: "$165.00",
      ext: "$171,600.00"
    }, {
      cost: "Labor",
      desc: "UX designer — remediation & testing (480 hrs)",
      qty: 480,
      rate: "$135.00",
      ext: "$64,800.00"
    }, {
      cost: "Material",
      desc: "Automated audit tooling licenses",
      qty: 4,
      rate: "$2,000.00",
      ext: "$8,000.00"
    }, {
      cost: "Travel",
      desc: "On-site validation sessions",
      qty: 1,
      rate: "$4,100.00",
      ext: "$4,100.00"
    }]
  },
  // ---- Vendor: my subcontracts ----
  contracts: [{
    id: "c1",
    title: "Grants management web application",
    contractType: "FFP",
    value: "$214,000.00",
    status: "Active",
    esign: "Signed"
  }, {
    id: "c2",
    title: "Case management API integration",
    contractType: "T&M",
    value: "$98,750.00",
    status: "Awarded",
    esign: "Awaiting signature"
  }],
  // ---- Vendor: compliance documents ----
  documents: [{
    name: "W-9 (2026).pdf",
    type: "Tax",
    status: "Verified",
    tone: "success"
  }, {
    name: "Certificate of Insurance.pdf",
    type: "Insurance",
    status: "Verified",
    tone: "success"
  }, {
    name: "Capability statement.pdf",
    type: "Capability",
    status: "Scanning",
    tone: "info"
  }, {
    name: "Past performance — VA.pdf",
    type: "Reference",
    status: "Action needed",
    tone: "warn"
  }],
  // ---- Split-view approval detail (release gate) ----
  approvalDetail: {
    title: "Section 508 audit & accessible UI remediation",
    notice: "36C10B26R0042",
    agency: "Dept. of Veterans Affairs",
    feasibility: 81,
    sourceLines: ["1.0 The contractor shall conduct a full Section 508 conformance audit of the claims portal.", "2.1 Remediation of all Level A and AA failures per WCAG 2.1 is required.", "2.2 Automated and manual testing artifacts shall be delivered.", "3.0 Period of performance: 12 months from award.", "4.1 Key personnel must include a certified accessibility specialist."],
    evalLines: [{
      item: "Conformance audit",
      markup: "Standard",
      vendor: "Meridian Federal",
      flag: false
    }, {
      item: "WCAG 2.1 AA remediation",
      markup: "Standard",
      vendor: "Meridian Federal",
      flag: false
    }, {
      item: "Testing artifacts",
      markup: "Standard",
      vendor: "Anchor Data Systems",
      flag: false
    }, {
      item: "Certified specialist (key personnel)",
      markup: "Review",
      vendor: "Low confidence — confirm cert",
      flag: true
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/data.js", error: String((e && e.message) || e) }); }

// ui_kits/marketing/data.js
try { (() => {
// Public brand content for Burger Consulting LLC (platform brand: BurgerGov).
// Truthfulness contract: every value is literally true today; anything not yet
// issued is an explicit placeholder. No fabricated performance metrics.
window.SITE = {
  brand: "BurgerGov",
  legal: "Burger Consulting LLC",
  domain: "burgergov.com",
  tagline: "Federal software, systems design, and IT services — built to spec, owned end to end.",
  hero: {
    kicker: "Burger Consulting LLC · AI-First Software & Systems",
    title: "Software, systems, and interfaces — built to spec and owned end to end.",
    lede: "An AI-first, founder-led firm building software, systems, and the interfaces on top — for government and private-sector clients alike. Scoped precisely, built to standard, and answered for by the engineer who writes the code."
  },
  // Factual "at a glance" facts — not performance metrics.
  facts: [{
    k: "Discipline",
    v: "Federal IT services"
  }, {
    k: "Core NAICS",
    v: "541511 · 541512 · 541519"
  }, {
    k: "Business size",
    v: "Small business"
  }, {
    k: "Standard",
    v: "Section 508 / WCAG 2.1 AA"
  }],
  principal: {
    name: "Timothy Burger",
    title: "Founder & Principal Engineer",
    initials: "TB"
  },
  stack: ["Python", "JavaScript / TypeScript", "Rust", "SQL / Databases", "Section 508 / WCAG 2.1 AA"],
  nav: [{
    href: "capabilities",
    label: "Capabilities"
  }, {
    href: "about",
    label: "About"
  }, {
    href: "contact",
    label: "Contact"
  }],
  naics: [{
    code: "541511",
    label: "Custom Computer Programming Services"
  }, {
    code: "541512",
    label: "Computer Systems Design Services"
  }, {
    code: "541519",
    label: "Other Computer Related Services"
  }],
  // Capability matrix — each NAICS code mapped to the work it covers.
  capabilities: [{
    code: "541511",
    name: "Custom Software Development",
    summary: "Writing, modifying, testing, and supporting software built around a specific need — for agencies, companies, and founders alike.",
    work: ["Custom software, web & mobile applications", "Database-backed application development", "Bespoke integrations & APIs", "Software analysis, testing & ongoing support"]
  }, {
    code: "541512",
    name: "Systems Design & Integration",
    summary: "Planning and designing systems that integrate hardware, software, and communications — from enterprise rollouts to a growing company's stack.",
    work: ["Systems integration & IT architecture", "Enterprise & network design", "Implementation, configuration & rollout", "Training and post-deployment support"]
  }, {
    code: "541519",
    name: "Specialized IT Services",
    summary: "Specialized technology services beyond programming and systems design, scoped to whatever the client runs on.",
    work: ["IT disaster recovery & continuity", "Software installation & configuration", "Technical training & enablement", "Infrastructure troubleshooting & management"]
  }],
  adjacency: "Federal credentials are not a fence. Once registered, a firm may compete for work beyond the codes it first applied under. We lead with the disciplines above — and selectively take on adjacent, complementary efforts where our software and systems expertise clearly applies.",
  // AI-first positioning — a client-facing capability, not a description of our own process.
  ai: {
    title: "AI woven through everything we build.",
    lede: "We design, build, and automate with AI at the core — and bring proven expertise integrating it into real products and operations that hold up in production.",
    pillars: [{
      name: "Design & build with AI",
      text: "Modern AI tooling accelerates how we generate software and UI/UX — more iterations, faster, without compromising craft or review."
    }, {
      name: "Automate the busywork",
      text: "We design AI-driven workflows and integrations that remove manual steps, so teams spend their time on judgment, not repetition."
    }, {
      name: "Implemented, not theorized",
      text: "Working AI integrations in production — our expertise is making them reliable, governed, and genuinely useful to the business."
    }]
  },
  // Delivery approach — replaces any "autonomous engine" framing.
  approach: [{
    name: "Built to spec",
    text: "Scope, data model, and acceptance criteria are agreed and documented up front — no surprises at delivery."
  }, {
    name: "Compliance-minded",
    text: "Experience in regulated domains means data sensitivity and audit-readiness are designed in, not bolted on."
  }, {
    name: "Accessible by default",
    text: "Section 508 and WCAG 2.1 AA are the baseline standard on every interface we ship."
  }, {
    name: "Personally accountable",
    text: "One owner writes the code, owns the data model, and answers for the outcome."
  }],
  // Two real subcontractor paths (mirrors hermes2):
  //  · paths[0] = /quote/[token]  — one-time, no account, quick quote
  //  · paths[1] = /invite + /login — full portal account for ongoing work
  partner: {
    intro: "We identify and contact subcontractors directly when their capabilities fit a specific solicitation. Your invitation always arrives as a secure link in your email — there is nothing to apply for here. Depending on the opportunity, that link opens one of two paths.",
    paths: [{
      tag: "Path A · No account",
      name: "Submit a one-time quote",
      text: "For a single solicitation, your link opens a secure quote form directly — review the scope, enter line items, attach your document, and submit. No account, no password.",
      bullets: ["Opens straight from your email link", "Single-use, tied to one solicitation", "Upload a PDF or DOCX (max 25 MB)"],
      cta: "How it works"
    }, {
      tag: "Path B · Portal account",
      name: "Work from the subcontractor portal",
      text: "For ongoing work, your link helps you set a password once. After that, sign in anytime to track open RFQs, prepare quotes, and manage subcontracts and documents across multiple sessions.",
      bullets: ["Set a password once, then sign in anytime", "Track Open RFQs, Quotes, Subcontracts & Documents", "Built for repeat, multi-session work"],
      cta: "Sign in to the portal →"
    }]
  },
  credentials: [{
    label: "SAM.gov registration",
    value: "Active",
    state: "confirmed"
  }, {
    label: "Unique Entity ID (UEI)",
    value: "Provided on request",
    state: "assigned"
  }, {
    label: "CAGE code",
    value: "Pending assignment",
    state: "pending"
  }, {
    label: "Business size",
    value: "Small business",
    state: "confirmed"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/data.js", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-chrome.jsx
try { (() => {
// Marketing chrome — nav (brand, links, theme toggle, portal entries) + footer.
const {
  Cta,
  Button,
  PlaceholderBadge
} = window.BurgerGovDesignSystem_d0c3b4;
const S = window.SITE;
const CONSOLE_URL = "../console/index.html";

// Ambient living-network canvas — a drifting constellation of nodes + distance-faded
// links (the "algorithmic network"), gently reactive to the pointer. Theme-aware,
// pauses when the tab is hidden, and renders a single static frame for reduced-motion.
function AmbientCanvas({
  theme
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const hexToRgb = (raw, fb) => {
      let h = (raw || "").trim().replace("#", "");
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      if (!/^[0-9a-f]{6}$/i.test(h)) return fb;
      const n = parseInt(h, 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    };
    const pRGB = hexToRgb(css.getPropertyValue("--studio-primary"), [59, 130, 246]);
    const sRGB = hexToRgb(css.getPropertyValue("--signal"), [52, 211, 153]);
    let W = 0,
      H = 0,
      DPR = 1,
      nodes = [],
      raf = 0,
      running = true;
    const pointer = {
      x: -9999,
      y: -9999,
      active: false
    };
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.max(34, Math.min(94, Math.round(W * H / 13000)));
      nodes = Array.from({
        length: count
      }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        c: Math.random() < 0.5 ? sRGB : pRGB,
        r: Math.random() * 1.6 + 0.8
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -30) n.x = W + 30;else if (n.x > W + 30) n.x = -30;
        if (n.y < -30) n.y = H + 30;else if (n.y > H + 30) n.y = -30;
      }
      const maxD = 158,
        maxD2 = maxD * maxD;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x,
            dy = a.y - b.y,
            d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const t = 1 - Math.sqrt(d2) / maxD;
            ctx.strokeStyle = `rgba(${a.c[0]},${a.c[1]},${a.c[2]},${t * 0.26})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        let near = 0;
        if (pointer.active) {
          const dx = a.x - pointer.x,
            dy = a.y - pointer.y,
            pr = 240,
            d2 = dx * dx + dy * dy;
          if (d2 < pr * pr) {
            const t = 1 - Math.sqrt(d2) / pr;
            near = t;
            a.x += dx / (d2 + 500) * 26;
            a.y += dy / (d2 + 500) * 26; // gentle repel
            ctx.strokeStyle = `rgba(${sRGB[0]},${sRGB[1]},${sRGB[2]},${t * 0.6})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${a.c[0]},${a.c[1]},${a.c[2]},${0.7 + near * 0.3})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + near * 1.6, 0, 6.283185);
        ctx.fill();
      }
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    resize();
    if (reduce) frame();else raf = requestAnimationFrame(frame);
    const onResize = () => {
      resize();
      if (reduce) frame();
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    const onMove = e => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onOut = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerout", onOut);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
    };
  }, [theme]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    className: "bgNet",
    "aria-hidden": "true"
  });
}
function Monogram() {
  return /*#__PURE__*/React.createElement("span", {
    className: "brandMark"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 28 28",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "28",
    height: "28",
    rx: "6",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 7.5h6.4c2.5 0 4 1.3 4 3.3 0 1.4-.8 2.5-2.1 2.9 1.6.3 2.6 1.5 2.6 3.1 0 2.3-1.7 3.7-4.4 3.7H9V7.5zm3 2.4v3h2.7c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5H12zm0 5.2v3.3h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.7-1.9-1.7H12z",
    fill: "#fff"
  })));
}
function SunIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  }));
}
function MoonIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  }));
}
function Header({
  route,
  go,
  theme,
  toggleTheme
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "navInner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand",
    onClick: () => go("home"),
    role: "link",
    "aria-label": "BurgerGov \u2014 home"
  }, /*#__PURE__*/React.createElement("img", {
    className: "brandLogo",
    src: "assets/burgergov-logo.png",
    alt: "",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "brandName"
  }, "BURGERGOV", /*#__PURE__*/React.createElement("span", {
    className: "brandTld"
  }, ".com"))), /*#__PURE__*/React.createElement("nav", {
    className: "navLinks",
    "aria-label": "Primary"
  }, S.nav.map(l => /*#__PURE__*/React.createElement("button", {
    key: l.href,
    className: "navLink" + (route === l.href ? " active" : ""),
    onClick: () => go(l.href)
  }, l.label))), /*#__PURE__*/React.createElement("span", {
    className: "navSpacer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "navTools"
  }, /*#__PURE__*/React.createElement("button", {
    className: "neuToggle",
    onClick: toggleTheme,
    "aria-label": "Toggle theme",
    title: theme === "command" ? "Switch to light" : "Switch to dark"
  }, theme === "command" ? /*#__PURE__*/React.createElement(SunIcon, null) : /*#__PURE__*/React.createElement(MoonIcon, null)), /*#__PURE__*/React.createElement("a", {
    className: "signin",
    href: CONSOLE_URL + "#vendor-login"
  }, /*#__PURE__*/React.createElement("span", {
    className: "signinText"
  }, "Subcontractor", /*#__PURE__*/React.createElement("br", null), "Login"), /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192")))));
}
function Footer({
  go
}) {
  const year = new Date().getFullYear();
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footerInner"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "footerName"
  }, S.brand), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: "0.92rem",
      lineHeight: 1.6
    }
  }, S.legal, " \u2014 a small business delivering custom software, database systems, and accessible UX/UI for federal agencies and prime contractors."), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      marginTop: 10,
      fontSize: "0.92rem"
    }
  }, "Mailing address ", /*#__PURE__*/React.createElement(PlaceholderBadge, null, "published at launch"))), /*#__PURE__*/React.createElement("nav", {
    className: "footerCol",
    "aria-label": "Company"
  }, /*#__PURE__*/React.createElement("h2", null, "Company"), /*#__PURE__*/React.createElement("ul", null, S.nav.map(l => /*#__PURE__*/React.createElement("li", {
    key: l.href
  }, /*#__PURE__*/React.createElement("a", {
    onClick: () => go(l.href)
  }, l.label))), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: CONSOLE_URL + "#vendor-login"
  }, "Subcontractor portal")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: CONSOLE_URL + "#admin-login"
  }, "Admin console")))), /*#__PURE__*/React.createElement("div", {
    className: "footerCol"
  }, /*#__PURE__*/React.createElement("h2", null, "Registrations"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    onClick: () => go("capabilities")
  }, "Capability statement")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Privacy Policy")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", null, "Terms of Service"))), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      marginTop: 12,
      fontSize: "0.86rem",
      fontFamily: "var(--font-mono)"
    }
  }, "NAICS ", S.naics.map(n => n.code).join(" · ")))), /*#__PURE__*/React.createElement("div", {
    className: "footerBottom"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footerBottomInner"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 ", year, " ", S.legal, ". All rights reserved."), /*#__PURE__*/React.createElement("span", null, S.brand, " \xB7 ", S.domain))));
}
window.MarketingChrome = {
  Header,
  Footer,
  Monogram,
  AmbientCanvas,
  CONSOLE_URL
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/marketing-views.jsx
try { (() => {
// Marketing views — world-class home + inner pages. Theme-aware; composes DS primitives.
const {
  Cta,
  Button,
  PlaceholderBadge
} = window.BurgerGovDesignSystem_d0c3b4;
const SITE = window.SITE;
const {
  CONSOLE_URL
} = window.MarketingChrome;

// Count-up removed — the hero now shows factual capability facts, not metrics.
function Fact({
  f
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fact"
  }, /*#__PURE__*/React.createElement("div", {
    className: "factKey"
  }, f.k), /*#__PURE__*/React.createElement("div", {
    className: "factVal"
  }, f.v));
}

// Hero scene — a "code → live interface" composition: a glass code editor types
// out a real React component, which compiles into a floating rendered preview.
const HERO_CODE = [[["export ", "kw"], ["function ", "kw"], ["StatusCard", "fn"], ["({ item }) {", "pl"]], [["  const ", "kw"], ["status", "pl"], [" = ", "op"], ["useStatus", "fn"], ["(item);", "pl"]], [["  return ", "kw"], ["(", "pl"]], [["    <", "pl"], ["Card", "tag"], [" size=", "at"], ["\"sm\"", "str"], [">", "pl"]], [["      <", "pl"], ["Button", "tag"], [">Review →</", "pl"], ["Button", "tag"], [">", "pl"]], [["    </", "pl"], ["Card", "tag"], [">", "pl"]], [["  );", "pl"]], [["}", "pl"]]];
const HERO_CODE_TOTAL = HERO_CODE.reduce((a, l) => a + l.reduce((b, t) => b + t[0].length, 0), 0);
function useTyper(total, run, speed, hold) {
  speed = speed || 36;
  hold = hold || 2000;
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!run) {
      setN(total);
      return;
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(total);
      return;
    }
    let raf,
      last = 0,
      count = 0,
      holdUntil = 0,
      holding = false;
    const tick = t => {
      if (!last) last = t;
      if (holding) {
        if (t >= holdUntil) {
          holding = false;
          count = 0;
          setN(0);
          last = t;
        }
      } else if (t - last >= speed) {
        last = t;
        count += 1;
        setN(count);
        if (count >= total) {
          holding = true;
          holdUntil = t + hold;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, run, speed, hold]);
  return n;
}
function CodeLines({
  code,
  shown
}) {
  let idx = 0,
    lastFilled = -1;
  const lines = code.map(line => {
    const parts = [];
    line.forEach(([text, cls], ti) => {
      const start = idx,
        end = idx + text.length;
      const slice = shown >= end ? text : shown > start ? text.slice(0, shown - start) : "";
      if (slice) parts.push(/*#__PURE__*/React.createElement("span", {
        key: ti,
        className: "cv-tk cv-tk--" + cls
      }, slice));
      idx = end;
    });
    return parts;
  });
  lines.forEach((p, li) => {
    if (p.length) lastFilled = li;
  });
  const caretLine = lastFilled < 0 ? 0 : lastFilled;
  return lines.map((parts, li) => /*#__PURE__*/React.createElement("div", {
    className: "cv-line",
    key: li
  }, parts.length ? parts : /*#__PURE__*/React.createElement("span", null, "\u00a0"), li === caretLine ? /*#__PURE__*/React.createElement("span", {
    className: "cv-caret"
  }) : null));
}
function Hero3D() {
  const inner = React.useRef(null);
  const shown = useTyper(HERO_CODE_TOTAL, true);
  function move(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    if (inner.current) inner.current.style.transform = `rotateX(${6 - py * 12}deg) rotateY(${-13 + px * 16}deg)`;
  }
  function leave() {
    if (inner.current) inner.current.style.transform = "rotateX(6deg) rotateY(-13deg)";
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "scene",
    onMouseMove: move,
    onMouseLeave: leave,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sceneInner",
    ref: inner
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv-grid"
  }), /*#__PURE__*/React.createElement("div", {
    className: "cv-editor"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv-editor__bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cv-dot cv-dot--r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-dot cv-dot--y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-dot cv-dot--g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-file"
  }, "StatusCard.tsx"), /*#__PURE__*/React.createElement("span", {
    className: "cv-branch"
  }, "main")), /*#__PURE__*/React.createElement("pre", {
    className: "cv-code"
  }, /*#__PURE__*/React.createElement(CodeLines, {
    code: HERO_CODE,
    shown: shown
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cv-preview"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cv-preview__label"
  }, "Live preview"), /*#__PURE__*/React.createElement("div", {
    className: "cv-mini-field"
  }), /*#__PURE__*/React.createElement("div", {
    className: "cv-mini-btn"
  }, "Review \u2192")), /*#__PURE__*/React.createElement("div", {
    className: "cv-chip cv-chip--a"
  }, "</>"), /*#__PURE__*/React.createElement("div", {
    className: "cv-chip cv-chip--b"
  }, "{ }"), /*#__PURE__*/React.createElement("span", {
    className: "cv-flow cv-flow--1"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-flow cv-flow--2"
  })));
}
function useScrollProgress(ref) {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = -el.getBoundingClientRect().top;
      setP(total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

// Larger-scale "code → interface" band: a wide editor types a full component while
// the real DS primitives assemble in a live-preview panel, line by line.
const BUILD_CODE = [[["export ", "kw"], ["function ", "kw"], ["RecordForm", "fn"], ["({ record }) {", "pl"]], [["  const ", "kw"], ["{ values, save } ", "pl"], ["= ", "op"], ["useRecord", "fn"], ["(record);", "pl"]], [["  return ", "kw"], ["(", "pl"]], [["    <", "pl"], ["Card", "tag"], [" size=", "at"], ["\"sm\"", "str"], [">", "pl"]], [["      <", "pl"], ["Badge", "tag"], [" tone=", "at"], ["\"success\"", "str"], [">Section 508 AA</", "pl"], ["Badge", "tag"], [">", "pl"]], [["      <", "pl"], ["Field", "tag"], [" label=", "at"], ["\"Applicant name\"", "str"], [" defaultValue=", "at"], ["\"Jordan Vega\"", "str"], [" />", "pl"]], [["      <", "pl"], ["Field", "tag"], [" label=", "at"], ["\"Case ID\"", "str"], [" defaultValue=", "at"], ["\"CMS-2025-0142\"", "str"], [" />", "pl"]], [["      <", "pl"], ["Button", "tag"], [" block onClick=", "at"], ["{save}", "pl"], [">Save record</", "pl"], ["Button", "tag"], [">", "pl"]], [["    </", "pl"], ["Card", "tag"], [">", "pl"]], [["  );", "pl"]], [["}", "pl"]]];
const lineEnd = i => BUILD_CODE.slice(0, i + 1).reduce((a, l) => a + l.reduce((b, t) => b + t[0].length, 0), 0);
const BUILD_TOTAL = lineEnd(BUILD_CODE.length - 1);
const BUILD_STEPS = {
  card: lineEnd(3),
  badge: lineEnd(4),
  f1: lineEnd(5),
  f2: lineEnd(6),
  btn: lineEnd(7)
};
function BuildScene() {
  const {
    Card,
    Button,
    Field,
    Badge
  } = window.BurgerGovDesignSystem_d0c3b4;
  const scroller = React.useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const progress = useScrollProgress(scroller);
  const base = lineEnd(0);
  const shown = reduce ? BUILD_TOTAL : Math.round(base + progress * (BUILD_TOTAL - base));
  const seen = k => shown >= BUILD_STEPS[k];
  const done = shown >= BUILD_TOTAL;
  return /*#__PURE__*/React.createElement("div", {
    className: "buildScroller",
    ref: scroller
  }, /*#__PURE__*/React.createElement("div", {
    className: "buildSticky"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "buildHead"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Engineered, not assembled"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "We write the software ourselves."), /*#__PURE__*/React.createElement("p", {
    className: "sectionLede"
  }, "From the data model up, every interface is hand-built to specification on a consistent, accessible design system. Scroll to watch a record component come together, primitive by primitive.")), /*#__PURE__*/React.createElement("div", {
    className: "buildGrid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "buildEditor"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cv-editor__bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cv-dot cv-dot--r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-dot cv-dot--y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-dot cv-dot--g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cv-file"
  }, "RecordForm.tsx"), /*#__PURE__*/React.createElement("span", {
    className: "cv-branch"
  }, done ? "compiled" : "compiling…")), /*#__PURE__*/React.createElement("pre", {
    className: "cv-code buildCode"
  }, /*#__PURE__*/React.createElement(CodeLines, {
    code: BUILD_CODE,
    shown: shown
  }))), /*#__PURE__*/React.createElement("div", {
    className: "buildPreview"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cv-preview__label"
  }, "Live preview \xB7 RecordForm"), /*#__PURE__*/React.createElement("div", {
    className: "bs-pop bs-stage" + (seen("card") ? " in" : "")
  }, /*#__PURE__*/React.createElement(Card, {
    size: "sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bs-pop bs-badgeRow" + (seen("badge") ? " in" : "")
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Section 508 AA")), /*#__PURE__*/React.createElement("div", {
    className: "bs-pop" + (seen("f1") ? " in" : "")
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Applicant name",
    defaultValue: "Jordan Vega"
  })), /*#__PURE__*/React.createElement("div", {
    className: "bs-pop" + (seen("f2") ? " in" : "")
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Case ID",
    defaultValue: "CMS-2025-0142"
  })), /*#__PURE__*/React.createElement("div", {
    className: "bs-pop" + (seen("btn") ? " in" : "")
  }, /*#__PURE__*/React.createElement(Button, {
    block: true
  }, "Save record")))))))));
}
function Credentials() {
  return /*#__PURE__*/React.createElement("ul", {
    className: "credentials"
  }, SITE.credentials.map(c => /*#__PURE__*/React.createElement("li", {
    key: c.label,
    className: "cred"
  }, /*#__PURE__*/React.createElement("span", {
    className: "credLabel"
  }, c.label), /*#__PURE__*/React.createElement("span", {
    className: "credValue"
  }, c.value, c.state === "pending" ? /*#__PURE__*/React.createElement(PlaceholderBadge, null, "Pending") : null, c.state === "assigned" ? /*#__PURE__*/React.createElement(PlaceholderBadge, null, "On request") : null))));
}
function CapabilityMatrix() {
  return /*#__PURE__*/React.createElement("div", {
    className: "matrix"
  }, SITE.capabilities.map(c => /*#__PURE__*/React.createElement("article", {
    key: c.code,
    className: "matrixCard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "matrixHead"
  }, /*#__PURE__*/React.createElement("span", {
    className: "matrixCode"
  }, "NAICS ", c.code), /*#__PURE__*/React.createElement("h3", {
    className: "matrixName"
  }, c.name), /*#__PURE__*/React.createElement("p", {
    className: "matrixSummary"
  }, c.summary)), /*#__PURE__*/React.createElement("ul", {
    className: "workList"
  }, c.work.map(w => /*#__PURE__*/React.createElement("li", {
    key: w,
    className: "workItem"
  }, w))))));
}
function AdjacencyNote() {
  return /*#__PURE__*/React.createElement("aside", {
    className: "adjacency"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adjacencyTag"
  }, "Beyond the core"), /*#__PURE__*/React.createElement("p", {
    className: "adjacencyText"
  }, SITE.adjacency));
}
function AISection() {
  return /*#__PURE__*/React.createElement("div", {
    className: "aiGrid"
  }, SITE.ai.pillars.map((p, i) => /*#__PURE__*/React.createElement("article", {
    key: p.name,
    className: "aiCard"
  }, /*#__PURE__*/React.createElement("span", {
    className: "aiIndex",
    "aria-hidden": "true"
  }, "AI"), /*#__PURE__*/React.createElement("h3", {
    className: "aiName"
  }, p.name), /*#__PURE__*/React.createElement("p", {
    className: "aiText"
  }, p.text))));
}
function ApproachSection() {
  return /*#__PURE__*/React.createElement("div", {
    className: "approachGrid"
  }, SITE.approach.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.name,
    className: "stage"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stageNum"
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    className: "stageName"
  }, a.name), /*#__PURE__*/React.createElement("p", {
    className: "stageText"
  }, a.text))));
}
function PartnerSection({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "partnerWrap"
  }, /*#__PURE__*/React.createElement("p", {
    className: "sectionLede",
    style: {
      maxWidth: "72ch"
    }
  }, SITE.partner.intro), /*#__PURE__*/React.createElement("div", {
    className: "pathSplit"
  }, SITE.partner.paths.map((p, i) => /*#__PURE__*/React.createElement("article", {
    key: p.name,
    className: "pathCard" + (i === 1 ? " pathCard--primary" : "")
  }, /*#__PURE__*/React.createElement("span", {
    className: "pathTag"
  }, p.tag), /*#__PURE__*/React.createElement("h3", {
    className: "pathName"
  }, p.name), /*#__PURE__*/React.createElement("p", {
    className: "pathText"
  }, p.text), /*#__PURE__*/React.createElement("ul", {
    className: "pathList"
  }, p.bullets.map(b => /*#__PURE__*/React.createElement("li", {
    key: b,
    className: "pathItem"
  }, b))), i === 1 ? /*#__PURE__*/React.createElement("div", {
    className: "pathFoot"
  }, /*#__PURE__*/React.createElement(Cta, {
    href: CONSOLE_URL + "#vendor-login"
  }, p.cta)) : /*#__PURE__*/React.createElement("div", {
    className: "pathFoot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pathNote"
  }, "Opens automatically from your invitation link"))))), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: "0.9rem",
      marginTop: "var(--space-6)"
    }
  }, "Not yet invited? We reach out directly when a solicitation fits your capabilities \u2014 there is nothing to apply for here."));
}

// ============================================================
// Helpers + interlude scenes (Option 1 flow, Option 3 fabric)
// ============================================================
function mvCssVar(name, fb) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}
function mvHexToRgb(raw, fb) {
  let h = (raw || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return fb;
  const n = parseInt(h, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

// Option 1 — manual tasks (left) pulled through an AI core and emerging
// as automated outcomes (right). Continuous pulses; one lane lights at a time.
const AF_IN = [{
  name: "Manual data entry",
  sub: "repeat"
}, {
  name: "Status update emails",
  sub: "repeat"
}, {
  name: "Copy-paste between tools",
  sub: "repeat"
}, {
  name: "Routine report exports",
  sub: "repeat"
}];
const AF_OUT = [{
  name: "Validated records",
  sub: "automated"
}, {
  name: "Routed updates",
  sub: "automated"
}, {
  name: "Reports on demand",
  sub: "automated"
}, {
  name: "Time back for judgment",
  sub: "your team",
  hi: true
}];
// Flow palette — refined red → amber → green (stop → process → done), legible on the void.
const AF_R = [214, 72, 72],
  AF_Y = [224, 168, 58],
  AF_G = [46, 176, 110];
function afColAt(t) {
  t = Math.max(0, Math.min(1, t));
  const lp = (a, b, u) => [Math.round(a[0] + (b[0] - a[0]) * u), Math.round(a[1] + (b[1] - a[1]) * u), Math.round(a[2] + (b[2] - a[2]) * u)];
  return t < 0.5 ? lp(AF_R, AF_Y, t / 0.5) : lp(AF_Y, AF_G, (t - 0.5) / 0.5);
}
const AF_CYCLE = 3600;
// Circular neural network: nodes sampled in a disc, each an animated 0/1, with a
// code pulse sweeping left→right through the mesh and "AI" woven into the center.
// Rendered on a canvas inside the SVG via <foreignObject>.
function genBrainNet() {
  const Cx = 107,
    Cy = 92,
    Rc = 46;
  const boundary = [],
    NB = 28;
  for (let i = 0; i < NB; i++) {
    const a = i / NB * Math.PI * 2;
    boundary.push([Cx + Math.cos(a) * Rc, Cy + Math.sin(a) * Rc]);
  }
  const interior = [],
    minD = 10.5;
  for (let i = 0; i < 3000; i++) {
    const a = Math.random() * Math.PI * 2,
      r = Math.sqrt(Math.random()) * (Rc - 3.5);
    const x = Cx + Math.cos(a) * r,
      y = Cy + Math.sin(a) * r;
    let ok = true;
    for (const n of interior) {
      const dx = n[0] - x,
        dy = n[1] - y;
      if (dx * dx + dy * dy < minD * minD) {
        ok = false;
        break;
      }
    }
    if (ok) for (const n of boundary) {
      const dx = n[0] - x,
        dy = n[1] - y;
      if (dx * dx + dy * dy < minD * 0.85 * (minD * 0.85)) {
        ok = false;
        break;
      }
    }
    if (ok) interior.push([x, y]);
  }
  const nodes = [...boundary, ...interior].map(n => ({
    x: n[0],
    y: n[1],
    ch: Math.random() < 0.5 ? "0" : "1",
    ph: Math.random() * 6.28,
    armed: true
  }));
  const thr = 23,
    edges = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const dx = nodes[i].x - nodes[j].x,
      dy = nodes[i].y - nodes[j].y;
    if (dx * dx + dy * dy < thr * thr) edges.push([i, j]);
  }
  return {
    nodes,
    edges
  };
}
function BrainNet({
  theme
}) {
  const ref = React.useRef(null);
  const data = React.useMemo(genBrainNet, []);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colAt = afColAt;
    const {
      nodes,
      edges
    } = data;
    const minX = 30,
      maxX = 184,
      minY = 42,
      maxY = 142,
      LW = maxX - minX,
      LH = maxY - minY;
    const sig = 22,
      period = AF_CYCLE,
      span = LW + sig * 3;
    let W = 0,
      H = 0,
      SS = 2.6,
      raf = 0,
      running = true;
    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * SS);
      canvas.height = Math.round(H * SS);
      ctx.setTransform(SS, 0, 0, SS, 0, 0);
    }
    function frame(ts) {
      const t = ts;
      const sX = W / LW,
        sY = H / LH,
        fs = Math.max(7, sX * 7.5);
      const waveX = minX - sig + t % period / period * span;
      const mx = x => (x - minX) * sX,
        my = y => (y - minY) * sY;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      for (const [i, j] of edges) {
        const a = nodes[i],
          b = nodes[j],
          midx = (a.x + b.x) / 2;
        const dd = midx - waveX,
          inten = Math.exp(-(dd * dd) / (2 * sig * sig));
        const col = colAt((midx - minX) / LW);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.1 + inten * 0.55})`;
        ctx.lineWidth = 0.5 + inten * 1.2;
        ctx.beginPath();
        ctx.moveTo(mx(a.x), my(a.y));
        ctx.lineTo(mx(b.x), my(b.y));
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${fs}px monospace`;
      for (const n of nodes) {
        const dd = n.x - waveX,
          inten = Math.exp(-(dd * dd) / (2 * sig * sig));
        if (inten > 0.55 && n.armed) {
          n.ch = Math.random() < 0.5 ? "0" : "1";
          n.armed = false;
        }
        if (inten < 0.2) {
          n.armed = true;
          if (Math.random() < 0.004) n.ch = Math.random() < 0.5 ? "0" : "1";
        }
        const bright = Math.min(1, (0.5 + 0.18 * Math.sin(t * 0.003 + n.ph)) * 0.7 + inten);
        const col = colAt((n.x - minX) / LW);
        ctx.shadowBlur = 3 + inten * 16;
        ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.45 + bright * 0.55})`;
        ctx.fillText(n.ch, mx(n.x), my(n.y));
      }
      ctx.shadowBlur = 0;
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    resize();
    if (reduce) frame(period * 0.5);else raf = requestAnimationFrame(frame);
    const onResize = () => {
      resize();
      if (reduce) frame(period * 0.5);
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme, data]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    style: {
      width: "100%",
      height: "100%",
      display: "block"
    },
    "aria-hidden": "true"
  });
}

// "AI" label above the circle, colored with the same red→amber→green flow and a
// bright highlight that sweeps left→right in sync with the network pulse.
function AILabel({
  theme
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0,
      H = 0,
      SS = 2.6,
      raf = 0,
      running = true;
    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * SS);
      canvas.height = Math.round(H * SS);
      ctx.setTransform(SS, 0, 0, SS, 0, 0);
    }
    function draw(phase) {
      ctx.clearRect(0, 0, W, H);
      const fs = Math.min(H * 0.84, W * 0.42),
        tw = fs * 1.2,
        x0 = W / 2 - tw / 2;
      ctx.font = `800 ${fs}px "Hanken Grotesk", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const g = ctx.createLinearGradient(x0, 0, x0 + tw, 0);
      g.addColorStop(0, "rgb(214,72,72)");
      g.addColorStop(0.5, "rgb(224,168,58)");
      g.addColorStop(1, "rgb(46,176,110)");
      ctx.shadowBlur = fs * 0.3;
      ctx.shadowColor = "rgba(46,176,110,0.35)";
      ctx.fillStyle = g;
      ctx.fillText("AI", W / 2, H / 2);
      ctx.shadowBlur = 0;
      // moving highlight, clipped to the letters
      const hx = x0 - tw * 0.3 + tw * 1.6 * phase;
      ctx.globalCompositeOperation = "source-atop";
      const hg = ctx.createRadialGradient(hx, H / 2, 0, hx, H / 2, tw * 0.5);
      hg.addColorStop(0, "rgba(255,255,255,0.8)");
      hg.addColorStop(0.5, "rgba(255,255,255,0.18)");
      hg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    function frame(ts) {
      draw(ts % AF_CYCLE / AF_CYCLE);
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    resize();
    if (reduce) draw(0.5);else raf = requestAnimationFrame(frame);
    const onResize = () => {
      resize();
      if (reduce) draw(0.5);
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    style: {
      width: "100%",
      height: "100%",
      display: "block"
    },
    "aria-hidden": "true"
  });
}
function AutomationFlow({
  theme
}) {
  const [active, setActive] = React.useState(0);
  const [outOn, setOutOn] = React.useState(false);
  const rainRef = React.useRef(null);
  // Phase-lock the lane highlight to the brain's left→right pulse via a shared
  // absolute clock, so one task visibly feeds in, sweeps through, and completes.
  React.useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setActive(0);
      setOutOn(true);
      return;
    }
    let raf = 0,
      laneRef = -1,
      outRef = false;
    const tick = () => {
      const now = performance.now(),
        p = now % AF_CYCLE / AF_CYCLE,
        l = Math.floor(now / AF_CYCLE) % 4,
        o = p > 0.78;
      if (l !== laneRef) {
        laneRef = l;
        setActive(l);
      }
      if (o !== outRef) {
        outRef = o;
        setOutOn(o);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Subtle binary rain behind the SVG (transparent canvas over the glass panel)
  React.useEffect(() => {
    const canvas = rainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let Wd = 0,
      Hd = 0,
      DPR = 1,
      raf = 0,
      running = true,
      drops = [],
      cols = 0,
      last = 0;
    const step = 16;
    function resize() {
      const host = canvas.parentElement;
      DPR = Math.min(2, window.devicePixelRatio || 1);
      Wd = host.clientWidth;
      Hd = host.clientHeight;
      canvas.width = Wd * DPR;
      canvas.height = Hd * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.floor(Wd / step);
      drops = Array.from({
        length: cols
      }, () => Math.floor(Math.random() * (Hd / step)));
      ctx.clearRect(0, 0, Wd, Hd);
    }
    function draw() {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, Wd, Hd);
      ctx.restore();
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      for (let i = 0; i < cols; i++) {
        const x = i * step + 3,
          y = drops[i] * step;
        const c = afColAt(cols > 1 ? i / (cols - 1) : 0.5);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.3)`;
        ctx.fillText(Math.random() < 0.5 ? "0" : "1", x, y);
        if (y > Hd && Math.random() > 0.975) drops[i] = 0;else drops[i]++;
      }
    }
    function frame(t) {
      if (running) raf = requestAnimationFrame(frame);
      if (t - last < 90) return; // throttle for a calm, readable rain
      last = t;
      draw();
    }
    resize();
    if (reduce) {
      draw();
    } else raf = requestAnimationFrame(frame);
    const onResize = () => {
      resize();
      if (reduce) draw();
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const W = 940,
    H = 360,
    cx = 470,
    cy = 180;
  const cardW = 224,
    cardH = 52,
    gap = 18;
  const colTop = (H - (cardH * 4 + gap * 3)) / 2;
  const ys = [0, 1, 2, 3].map(i => colTop + i * (cardH + gap));
  const leftX = 26,
    rightX = W - 26 - cardW;
  const leftEdge = leftX + cardW,
    rightEdge = rightX;
  const inPath = y => {
    const sy = y + cardH / 2,
      ex = cx - 90,
      ey = cy,
      mx = (leftEdge + ex) / 2;
    return `M ${leftEdge} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
  };
  const outPath = y => {
    const sy = y + cardH / 2,
      sx = cx + 90,
      ey = cy,
      mx = (sx + rightEdge) / 2;
    return `M ${sx} ${ey} C ${mx} ${ey}, ${mx} ${sy}, ${rightEdge} ${sy}`;
  };
  // 0/1 glyphs streaming along each wire — binary-code automation.
  const inDigits = ["0", "1", "1"],
    outDigits = ["1", "0", "1"];
  return /*#__PURE__*/React.createElement("div", {
    className: "afScene"
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "af-rain",
    ref: rainRef,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("svg", {
    className: "af-svg",
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Manual tasks stream as binary through an AI core and emerge automated"
  }, ys.map((y, i) => /*#__PURE__*/React.createElement("path", {
    key: "iw" + i,
    className: "af-wire inWire",
    d: inPath(y),
    style: {
      opacity: active === i ? 0.95 : 0.4
    }
  })), ys.map((y, i) => /*#__PURE__*/React.createElement("path", {
    key: "ow" + i,
    className: "af-wire outWire",
    d: outPath(y),
    style: {
      opacity: active === i && outOn ? 0.95 : 0.4
    }
  })), ys.map((y, i) => inDigits.map((d, k) => /*#__PURE__*/React.createElement("text", {
    key: "ib" + i + "_" + k,
    className: "af-bit",
    textAnchor: "middle",
    fill: "#d64848"
  }, (i + k) % 2 ? "1" : "0", /*#__PURE__*/React.createElement("animateMotion", {
    dur: "2s",
    begin: `${i * 0.4 + k * 0.66}s`,
    repeatCount: "indefinite",
    path: inPath(y),
    keyPoints: "0;1",
    keyTimes: "0;1",
    calcMode: "spline",
    keySplines: "0.4 0 0.2 1"
  }), /*#__PURE__*/React.createElement("animate", {
    attributeName: "opacity",
    dur: "2s",
    begin: `${i * 0.4 + k * 0.66}s`,
    repeatCount: "indefinite",
    values: "0;1;1;0",
    keyTimes: "0;0.12;0.82;1"
  })))), ys.map((y, i) => outDigits.map((d, k) => /*#__PURE__*/React.createElement("text", {
    key: "ob" + i + "_" + k,
    className: "af-bit",
    textAnchor: "middle",
    fill: "#2eb06e"
  }, (i + k) % 2 ? "0" : "1", /*#__PURE__*/React.createElement("animateMotion", {
    dur: "2s",
    begin: `${0.9 + i * 0.4 + k * 0.66}s`,
    repeatCount: "indefinite",
    path: outPath(y),
    keyPoints: "0;1",
    keyTimes: "0;1",
    calcMode: "spline",
    keySplines: "0.4 0 0.2 1"
  }), /*#__PURE__*/React.createElement("animate", {
    attributeName: "opacity",
    dur: "2s",
    begin: `${0.9 + i * 0.4 + k * 0.66}s`,
    repeatCount: "indefinite",
    values: "0;1;1;0",
    keyTimes: "0;0.12;0.82;1"
  })))), AF_IN.map((c, i) => /*#__PURE__*/React.createElement("g", {
    key: "l" + i,
    style: {
      opacity: active === i ? 1 : 0.82,
      transition: "opacity .5s ease"
    }
  }, /*#__PURE__*/React.createElement("rect", {
    className: "af-card-bg",
    x: leftX,
    y: ys[i],
    width: cardW,
    height: cardH,
    rx: "12"
  }), /*#__PURE__*/React.createElement("text", {
    className: "af-sub",
    x: leftX + 16,
    y: ys[i] + 19
  }, c.sub), /*#__PURE__*/React.createElement("text", {
    className: "af-label",
    x: leftX + 16,
    y: ys[i] + 38
  }, c.name))), AF_OUT.map((c, i) => /*#__PURE__*/React.createElement("g", {
    key: "r" + i
  }, /*#__PURE__*/React.createElement("rect", {
    className: "af-card-bg" + (c.hi || active === i && outOn ? " lit" : ""),
    x: rightX,
    y: ys[i],
    width: cardW,
    height: cardH,
    rx: "12"
  }), /*#__PURE__*/React.createElement("text", {
    className: "af-sub",
    x: rightX + 16,
    y: ys[i] + 19,
    style: {
      fill: "var(--signal)"
    }
  }, c.sub), /*#__PURE__*/React.createElement("text", {
    className: "af-label",
    x: rightX + 16,
    y: ys[i] + 38
  }, c.name))), /*#__PURE__*/React.createElement("foreignObject", {
    x: cx - 90,
    y: cy - 158,
    width: "180",
    height: "62"
  }, /*#__PURE__*/React.createElement(AILabel, {
    theme: theme
  })), /*#__PURE__*/React.createElement("foreignObject", {
    x: cx - 150,
    y: cy - 100,
    width: "300",
    height: "200"
  }, /*#__PURE__*/React.createElement(BrainNet, {
    theme: theme
  }))));
}

// Option 3 — binary-code rain band. Transparent canvas so the page background
// shows through; re-inits on theme change.
function NeuralFabric({
  theme
}) {
  const wrap = React.useRef(null);
  const cvs = React.useRef(null);
  React.useEffect(() => {
    const canvas = cvs.current,
      container = wrap.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pRGB = mvHexToRgb(mvCssVar("--studio-primary", "#3b82f6"), [59, 130, 246]);
    const sRGB = mvHexToRgb(mvCssVar("--signal", "#34d399"), [52, 211, 153]);
    let W = 0,
      H = 0,
      DPR = 1,
      raf = 0,
      running = true,
      last = 0;
    let cols = 0,
      drops = [],
      speed = [];
    const step = 18,
      FS = 15;
    const pointer = {
      x: -9999,
      on: false
    };
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = container.clientWidth;
      H = container.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.ceil(W / step);
      drops = Array.from({
        length: cols
      }, () => Math.floor(Math.random() * (H / FS)));
      speed = Array.from({
        length: cols
      }, () => 0.5 + Math.random() * 0.9);
      ctx.clearRect(0, 0, W, H);
    }
    function draw() {
      // fade prior glyphs on a transparent canvas (matrix trail)
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.font = FS + "px monospace";
      ctx.textBaseline = "top";
      for (let i = 0; i < cols; i++) {
        const x = i * step + 4,
          y = drops[i] * FS;
        const near = pointer.on && Math.abs(x - pointer.x) < 70;
        const c = i % 6 === 0 || near ? sRGB : pRGB;
        // bright leading glyph
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${near ? 0.9 : 0.62})`;
        ctx.fillText(Math.random() < 0.5 ? "0" : "1", x, y);
        // soft glyph just behind the head
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.28)`;
        ctx.fillText(Math.random() < 0.5 ? "0" : "1", x, y - FS);
        if (y > H && Math.random() > 0.965) drops[i] = 0;else drops[i] += speed[i];
      }
    }
    function frame(t) {
      if (running) raf = requestAnimationFrame(frame);
      if (t - last < 70) return; // calm, readable cadence
      last = t;
      draw();
    }
    resize();
    if (reduce) {
      for (let i = 0; i < 40; i++) draw();
    } else raf = requestAnimationFrame(frame);
    const onResize = () => {
      resize();
      if (reduce) for (let i = 0; i < 40; i++) draw();
    };
    const onMove = e => {
      const r = container.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.on = true;
    };
    const onLeave = () => {
      pointer.on = false;
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("resize", onResize);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme]);
  return /*#__PURE__*/React.createElement("section", {
    className: "fabricBand",
    ref: wrap
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "nf-canvas",
    ref: cvs,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "nf-overlay"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "nf-kicker"
  }, "Burger Consulting LLC"), /*#__PURE__*/React.createElement("p", {
    className: "nf-line"
  }, "Software, systems, and interfaces \u2014 ", /*#__PURE__*/React.createElement("span", {
    className: "accentText"
  }, "owned end to end"), "."))));
}
function HomeView({
  go,
  theme
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heroLayout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heroCopy"
  }, /*#__PURE__*/React.createElement("span", {
    className: "statusPill reveal",
    style: {
      transitionDelay: "0.05s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "liveDot"
  }), SITE.hero.kicker), /*#__PURE__*/React.createElement("h1", {
    className: "heroTitle reveal",
    style: {
      transitionDelay: "0.12s"
    }
  }, "Software, systems,", /*#__PURE__*/React.createElement("br", null), "and interfaces \u2014", /*#__PURE__*/React.createElement("br", null), "built to spec", /*#__PURE__*/React.createElement("br", null), "and ", /*#__PURE__*/React.createElement("span", {
    className: "accentText"
  }, "owned", /*#__PURE__*/React.createElement("br", null), "end to end"), "."), /*#__PURE__*/React.createElement("p", {
    className: "heroLede reveal",
    style: {
      transitionDelay: "0.2s"
    }
  }, SITE.hero.lede), /*#__PURE__*/React.createElement("div", {
    className: "heroActions reveal",
    style: {
      transitionDelay: "0.32s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => go("contact")
  }, /*#__PURE__*/React.createElement(Cta, {
    href: "#"
  }, "Request a capability statement")), /*#__PURE__*/React.createElement(Cta, {
    href: CONSOLE_URL + "#vendor-login",
    variant: "secondary"
  }, "Subcontractor sign in \u2192"))), /*#__PURE__*/React.createElement("div", {
    className: "reveal",
    style: {
      transitionDelay: "0.22s"
    }
  }, /*#__PURE__*/React.createElement(Hero3D, null))), /*#__PURE__*/React.createElement("div", {
    className: "metricStrip"
  }, SITE.facts.map((f, i) => /*#__PURE__*/React.createElement(Fact, {
    key: i,
    f: f
  }))))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Capabilities"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Three core competencies, one accountable shop."), /*#__PURE__*/React.createElement("p", {
    className: "sectionLede"
  }, "Software and systems work that serves any client \u2014 government or commercial. Each competency below maps to the NAICS area it satisfies for federal contracts, but the same capability delivers just as well for private-sector teams and founders. These are our focus, not our limit."), /*#__PURE__*/React.createElement(CapabilityMatrix, null), /*#__PURE__*/React.createElement(AdjacencyNote, null))), /*#__PURE__*/React.createElement("section", {
    className: "buildBand"
  }, /*#__PURE__*/React.createElement(BuildScene, null)), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "AI-first by practice"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, SITE.ai.title), /*#__PURE__*/React.createElement("p", {
    className: "sectionLede"
  }, SITE.ai.lede), /*#__PURE__*/React.createElement(AISection, null))), /*#__PURE__*/React.createElement("section", {
    className: "section",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Automate the busywork"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Repetitive work in. Judgment out."), /*#__PURE__*/React.createElement("p", {
    className: "sectionLede"
  }, "The same automation we build for clients, shown plainly: routine tasks flow through an AI core and come back as outcomes a team can act on \u2014 freeing people for the work only judgment can do."), /*#__PURE__*/React.createElement(AutomationFlow, {
    theme: theme
  }))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "How we work"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Delivery you can hold someone accountable for."), /*#__PURE__*/React.createElement("p", {
    className: "sectionLede"
  }, "A small, senior shop with a hands-on ethos: clear scope, compliant by design, accessible by default, and one owner answerable for the result."), /*#__PURE__*/React.createElement(ApproachSection, null))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "For invited partners"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Working with us as a subcontractor."), /*#__PURE__*/React.createElement(PartnerSection, {
    go: go
  }))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Registrations"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle"
  }, "Where we stand today \u2014 stated plainly."), /*#__PURE__*/React.createElement("p", {
    className: "sectionLede"
  }, "We represent only what is true now. Anything pending is labeled as such; the UEI is shared with agencies and primes on request."), /*#__PURE__*/React.createElement(Credentials, null))), /*#__PURE__*/React.createElement("section", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "principal"
  }, /*#__PURE__*/React.createElement("img", {
    className: "avatar",
    src: "assets/founder.png",
    alt: SITE.principal.name
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Founder-led"), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-2)"
    }
  }, SITE.principal.name), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "0.85rem",
      letterSpacing: "0.04em",
      margin: "0 0 var(--space-4)"
    }
  }, SITE.principal.title), /*#__PURE__*/React.createElement("p", {
    className: "portalText",
    style: {
      maxWidth: "64ch"
    }
  }, "Timothy Burger personally scopes, designs, and builds every engagement. One accountable owner who writes the code, owns the data model, and answers for the outcome \u2014 the most honest trust signal a small firm can offer. You will always know exactly who is responsible for your project."), /*#__PURE__*/React.createElement("ul", {
    className: "tagList"
  }, SITE.stack.map(s => /*#__PURE__*/React.createElement("li", {
    key: s,
    className: "tag"
  }, s))))))), /*#__PURE__*/React.createElement(NeuralFabric, {
    theme: theme
  }), /*#__PURE__*/React.createElement("section", {
    className: "ctaBand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ctaInner"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "ctaTitle"
  }, "Let\u2019s talk about your requirement."), /*#__PURE__*/React.createElement("p", {
    className: "heroLede",
    style: {
      margin: "0 auto var(--space-6)",
      maxWidth: "52ch"
    }
  }, "Agencies and primes: request a capability statement or start a conversation about an upcoming effort."), /*#__PURE__*/React.createElement("div", {
    className: "ctaActions"
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => go("contact")
  }, /*#__PURE__*/React.createElement(Cta, {
    href: "#"
  }, "Request a capability statement")), /*#__PURE__*/React.createElement("span", {
    onClick: () => go("capabilities")
  }, /*#__PURE__*/React.createElement(Cta, {
    href: "#",
    variant: "secondary"
  }, "View capabilities")))))));
}
function CapabilitiesView() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    className: "pageHeader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Capability statement"), /*#__PURE__*/React.createElement("h1", {
    className: "heroTitle",
    style: {
      fontSize: "clamp(2.4rem,5vw,3.6rem)"
    }
  }, "What we deliver, mapped to how we\u2019re registered."), /*#__PURE__*/React.createElement("p", {
    className: "heroLede"
  }, "A plain account of Burger Consulting LLC\u2019s federal IT disciplines, technical stack, and registrations."))), /*#__PURE__*/React.createElement("section", {
    className: "section",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement(CapabilityMatrix, null), /*#__PURE__*/React.createElement(AdjacencyNote, null), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginTop: "var(--space-16)"
    }
  }, "Technical stack"), /*#__PURE__*/React.createElement("ul", {
    className: "tagList",
    style: {
      marginTop: "var(--space-4)"
    }
  }, SITE.stack.map(s => /*#__PURE__*/React.createElement("li", {
    key: s,
    className: "tag"
  }, s))), /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginTop: "var(--space-16)"
    }
  }, "Registrations"), /*#__PURE__*/React.createElement(Credentials, null))));
}
function AboutView() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    className: "pageHeader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "About"), /*#__PURE__*/React.createElement("h1", {
    className: "heroTitle",
    style: {
      fontSize: "clamp(2.4rem,5vw,3.6rem)"
    }
  }, "One accountable owner, end to end."))), /*#__PURE__*/React.createElement("section", {
    className: "section",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "principal",
    style: {
      marginTop: 0,
      marginBottom: "var(--space-16)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    className: "avatar",
    src: "assets/founder.png",
    alt: SITE.principal.name
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "sectionTitle",
    style: {
      marginBottom: "var(--space-2)"
    }
  }, SITE.principal.name), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "0.85rem"
    }
  }, SITE.principal.title), /*#__PURE__*/React.createElement("ul", {
    className: "tagList"
  }, SITE.stack.map(s => /*#__PURE__*/React.createElement("li", {
    key: s,
    className: "tag"
  }, s))))), /*#__PURE__*/React.createElement("div", {
    className: "prose"
  }, /*#__PURE__*/React.createElement("p", null, "Burger Consulting LLC is a small business delivering custom software, computer systems design, and specialized IT services for federal agencies and prime contractors. The principal has delivered across regulated and commercial domains \u2014 legal, medical, and ecommerce \u2014 the source of the right instincts for federal work: compliance awareness and data sensitivity."), /*#__PURE__*/React.createElement("h2", null, "How we work"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, "Built to spec \u2014 scope, data model, and acceptance criteria agreed up front."), /*#__PURE__*/React.createElement("li", null, "Compliance-minded \u2014 data sensitivity and audit-readiness designed in from day one."), /*#__PURE__*/React.createElement("li", null, "Accessible by default \u2014 Section 508 / WCAG 2.1 AA is a baseline, not an add-on."), /*#__PURE__*/React.createElement("li", null, "Personally accountable \u2014 one owner writes the code and answers for the outcome."))))));
}
function ContactView({
  sent,
  onSend
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    className: "pageHeader"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Contact"), /*#__PURE__*/React.createElement("h1", {
    className: "heroTitle",
    style: {
      fontSize: "clamp(2.4rem,5vw,3.6rem)"
    }
  }, "Let\u2019s talk about your requirement."), /*#__PURE__*/React.createElement("p", {
    className: "heroLede"
  }, "For agencies and prime contractors. Tell us about the effort and we\u2019ll follow up directly \u2014 every inquiry reaches the principal."))), /*#__PURE__*/React.createElement("section", {
    className: "section",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formCard"
  }, sent ? /*#__PURE__*/React.createElement("div", {
    role: "status"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "capTitle",
    style: {
      marginTop: 0
    }
  }, "Inquiry received."), /*#__PURE__*/React.createElement("p", {
    className: "capText"
  }, "Thank you \u2014 we will follow up directly. Direct email and phone are ", /*#__PURE__*/React.createElement(PlaceholderBadge, null, "published at launch"), ".")) : /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSend();
    }
  }, /*#__PURE__*/React.createElement(FieldRow, {
    label: "Your name",
    name: "name"
  }), /*#__PURE__*/React.createElement(FieldRow, {
    label: "Organization",
    name: "org"
  }), /*#__PURE__*/React.createElement(FieldRow, {
    label: "Email",
    name: "email",
    type: "email"
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "grid",
      gap: "0.5rem",
      marginBottom: "1rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: "0.9rem",
      color: "var(--studio-ink)"
    }
  }, "How can we help?"), /*#__PURE__*/React.createElement("textarea", {
    name: "message",
    rows: "4",
    className: "textarea"
  })), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    block: true
  }, "Send inquiry"))), /*#__PURE__*/React.createElement("aside", {
    className: "adjacency",
    style: {
      marginTop: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "adjacencyTag"
  }, "Invited subcontractor?"), /*#__PURE__*/React.createElement("p", {
    className: "adjacencyText"
  }, "If we\u2019ve reached out about a specific solicitation, you don\u2019t need this form \u2014 use the secure link from your invitation email, or ", /*#__PURE__*/React.createElement("a", {
    href: CONSOLE_URL + "#vendor-login",
    style: {
      color: "var(--link)",
      fontWeight: 600
    }
  }, "sign in to the portal"), " to review the scope and submit your proposal.")))));
}
function FieldRow({
  label,
  name,
  type = "text"
}) {
  const {
    Field
  } = window.BurgerGovDesignSystem_d0c3b4;
  return /*#__PURE__*/React.createElement(Field, {
    label: label,
    name: name,
    type: type
  });
}
window.MarketingViews = {
  HomeView,
  CapabilitiesView,
  AboutView,
  ContactView
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/marketing-views.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Brand = __ds_scope.Brand;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Cta = __ds_scope.Cta;

__ds_ns.PlaceholderBadge = __ds_scope.PlaceholderBadge;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Select = __ds_scope.Select;

})();
