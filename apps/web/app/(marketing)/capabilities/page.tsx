import type { Metadata } from "next";
import type { JSX } from "react";

import { CAPABILITIES, NAICS } from "@/lib/site";

import { Cta } from "../_components/Cta";
import { PlaceholderBadge } from "../_components/PlaceholderBadge";
import styles from "../_components/marketing.module.css";

// Dynamic (not static): the per-request CSP nonce from middleware requires per-request rendering. (7b)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Capabilities",
  description:
    "Custom software, database systems, accessible UX/UI, and systems integration — the four " +
    "offerings BurgerGov delivers to spec for federal agencies and prime contractors.",
};

/**
 * Capabilities ("/capabilities"). Lists ONLY what the firm actually does (from site.ts). The
 * capability-statement PDF is not yet final — shown as a visible placeholder, never a real download
 * (truthfulness contract, CLAUDE.md). The home hero's secondary CTA links to the #capability-statement
 * anchor below, so the id must stay exactly "capability-statement".
 */
export default function CapabilitiesPage(): JSX.Element {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1>Capabilities</h1>
          <p className={styles.lede}>
            Four focused offerings — custom software, database systems, accessible UX/UI, and systems
            integration — each engineered to spec and delivered directly by the principal.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What we deliver</h2>
          <div className={`${styles.grid} ${styles.grid2}`}>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>{CAPABILITIES[0]?.title}</h3>
              <p className={styles.cardText}>
                Full-stack systems built to specification in Python, JavaScript/TypeScript, and Rust —
                from API and service layers to the user-facing application, with the same engineer
                accountable end to end.
              </p>
            </article>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>{CAPABILITIES[1]?.title}</h3>
              <p className={styles.cardText}>
                Data modeling and database-backed applications designed for integrity and scale, with
                careful attention to the sensitivity of the data they hold.
              </p>
            </article>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>{CAPABILITIES[2]?.title}</h3>
              <p className={styles.cardText}>
                Usable, inclusive interfaces engineered to Section 508 and WCAG 2.1 AA — accessibility
                treated as a build requirement, not an afterthought.
              </p>
            </article>
            <article className={styles.card}>
              <h3 className={styles.cardTitle}>{CAPABILITIES[3]?.title}</h3>
              <p className={styles.cardText}>
                Legacy modernization, systems integration, and web-application delivery — connecting and
                renewing the systems an agency already depends on.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>NAICS codes</h2>
          <p className={styles.sectionLede}>
            The primary NAICS codes our capabilities map to.
          </p>
          <ul className={styles.prose}>
            {NAICS.map((n) => (
              <li key={n.code}>
                {n.code} — {n.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="capability-statement" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.pdfBlock}>
            <div>
              <h2 className={styles.sectionTitle}>Capability statement</h2>
              <PlaceholderBadge>PDF in preparation</PlaceholderBadge>
              <p className={styles.cardText}>
                Our formal one-page capability statement is being finalized. In the meantime, a summary
                of our capabilities and registration details is available on request.
              </p>
            </div>
            <div className={styles.pathActions}>
              <Cta href="/contact?intent=agency">Request capabilities</Cta>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
