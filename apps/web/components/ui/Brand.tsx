import type { JSX } from "react";

import { BRAND_NAME } from "@/lib/site";

import styles from "./Brand.module.css";

/**
 * The BurgerGov monogram + wordmark, shared across app chrome (auth cards, nav). Inline-SVG (no binary
 * asset, CSP-clean); the mark is decorative and the brand name is real text.
 */
export function Brand(): JSX.Element {
  return (
    <span className={styles.brand}>
      <span className={styles.mark} aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 28 28" focusable="false">
          <rect width="28" height="28" rx="6" fill="currentColor" />
          <path
            d="M9 7.5h6.4c2.5 0 4 1.3 4 3.3 0 1.4-.8 2.5-2.1 2.9 1.6.3 2.6 1.5 2.6 3.1 0 2.3-1.7 3.7-4.4 3.7H9V7.5zm3 2.4v3h2.7c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5H12zm0 5.2v3.3h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.7-1.9-1.7H12z"
            fill="#fff"
          />
        </svg>
      </span>
      <span className={styles.word}>{BRAND_NAME}</span>
    </span>
  );
}
