import Link from "next/link";
import type { JSX } from "react";

import { BRAND_NAME, NAV_LINKS } from "@/lib/site";

import { Cta } from "./Cta";
import styles from "./SiteHeader.module.css";

/** Inline-SVG monogram (no binary asset → standalone-safe + CSP-clean). */
function Monogram(): JSX.Element {
  return (
    <span className={styles.mark}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <rect width="28" height="28" rx="6" fill="currentColor" />
        <path
          d="M9 7.5h6.4c2.5 0 4 1.3 4 3.3 0 1.4-.8 2.5-2.1 2.9 1.6.3 2.6 1.5 2.6 3.1 0 2.3-1.7 3.7-4.4 3.7H9V7.5zm3 2.4v3h2.7c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5H12zm0 5.2v3.3h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.7-1.9-1.7H12z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

/** Public site header: brand link, primary nav, and the "Partner with us" teaming CTA. Server-rendered. */
export function SiteHeader(): JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${BRAND_NAME} home`}>
          <Monogram />
          {BRAND_NAME}
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={styles.navLink}>
            Subcontractor login
          </Link>
          <Cta href="/contact?intent=teaming">Partner with us</Cta>
        </nav>
      </div>
    </header>
  );
}
