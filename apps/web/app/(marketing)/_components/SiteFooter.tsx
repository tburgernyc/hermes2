import Link from "next/link";
import type { JSX } from "react";

import { BRAND_NAME, DOMAIN, LEGAL_NAME, NAICS, NAV_LINKS } from "@/lib/site";

import { PlaceholderBadge } from "./PlaceholderBadge";
import styles from "./SiteFooter.module.css";

/**
 * Public footer + CAN-SPAM-style identity block. The mailing address is read from OUTREACH_POSTAL_ADDRESS
 * (the same source the outreach email footer uses) — when it is not yet configured the address renders as
 * a visible placeholder rather than a fabricated location (truthfulness contract).
 */
export function SiteFooter(): JSX.Element {
  const postalAddress = process.env.OUTREACH_POSTAL_ADDRESS?.trim();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <p className={styles.name}>{BRAND_NAME}</p>
          <p className={styles.muted}>
            {LEGAL_NAME} — a small business. Custom software, database systems, and accessible UX/UI for
            federal agencies and prime contractors.
          </p>
          {postalAddress ? (
            <address className={`${styles.address} ${styles.muted}`}>{postalAddress}</address>
          ) : (
            <p className={`${styles.address} ${styles.muted}`}>
              Mailing address <PlaceholderBadge>published at launch</PlaceholderBadge>
            </p>
          )}
        </div>

        <nav className={styles.col} aria-label="Company">
          <h2>Company</h2>
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.col}>
          <h2>Legal</h2>
          <ul>
            <li>
              <Link href="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms of Service</Link>
            </li>
          </ul>
          <p className={styles.muted}>NAICS {NAICS.map((n) => n.code).join(" · ")}</p>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span>
            © {year} {LEGAL_NAME}. All rights reserved.
          </span>
          <span>
            {BRAND_NAME} · {DOMAIN}
          </span>
        </div>
      </div>
    </footer>
  );
}
