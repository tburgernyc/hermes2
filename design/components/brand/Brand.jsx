import React from "react";

/**
 * The BurgerGov monogram + wordmark, shared across app chrome (auth cards, nav). Inline-SVG mark
 * (decorative); the brand name is real text. `size` scales the whole lockup.
 */
export function Brand({ size = "md" }) {
  const dim = size === "lg" ? 34 : size === "sm" ? 22 : 26;
  const font = size === "lg" ? "1.6rem" : size === "sm" ? "0.95rem" : "1.05rem";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.55rem",
        fontWeight: 600,
        fontSize: font,
        letterSpacing: "-0.01em",
        color: "var(--studio-ink)",
      }}
    >
      <span style={{ color: "var(--studio-primary)", display: "inline-flex" }} aria-hidden="true">
        <svg width={dim} height={dim} viewBox="0 0 28 28" focusable="false">
          <rect width="28" height="28" rx="6" fill="currentColor" />
          <path
            d="M9 7.5h6.4c2.5 0 4 1.3 4 3.3 0 1.4-.8 2.5-2.1 2.9 1.6.3 2.6 1.5 2.6 3.1 0 2.3-1.7 3.7-4.4 3.7H9V7.5zm3 2.4v3h2.7c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5H12zm0 5.2v3.3h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.7-1.9-1.7H12z"
            fill="#fff"
          />
        </svg>
      </span>
      BurgerGov
    </span>
  );
}
