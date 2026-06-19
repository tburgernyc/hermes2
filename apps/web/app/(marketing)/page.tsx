import type { JSX } from "react";

import {
  CAPABILITIES,
  PRINCIPAL,
  SITE_DESCRIPTION,
  TAGLINE,
} from "@/lib/site";

import { Credentials } from "./_components/Credentials";
import { Cta } from "./_components/Cta";
import styles from "./_components/marketing.module.css";

// Dynamic (not static): the per-request CSP nonce from middleware requires per-request rendering so
// Next stamps the nonce onto its framework scripts. Output HTML is otherwise identical. (See 7b CSP.)
export const dynamic = "force-dynamic";

export const metadata = {
  description: SITE_DESCRIPTION,
};

/**
 * Home ("/"). The truthfulness contract (CLAUDE.md): every claim is literally true today. The firm is
 * young — no past performance, no contract counts, no set-asides. Founder-led accountability is the
 * credibility lever, so the principal is named as the accountable owner.
 */
export default function HomePage(): JSX.Element {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.crystal} aria-hidden="true">
          <span className={`${styles.shape} ${styles.shapeA}`} />
          <span className={`${styles.shape} ${styles.shapeB}`} />
          <span className={`${styles.shape} ${styles.shapeC}`} />
          <span className={`${styles.orb} ${styles.orbA}`} />
          <span className={`${styles.orb} ${styles.orbB}`} />
        </div>
        <div className={styles.heroInner}>
          <span className={styles.kicker}>Founder-led federal IT</span>
          <h1 className={styles.heroTitle}>
            Federal IT, engineered to spec by an accountable owner.
          </h1>
          <p className={styles.lede}>{TAGLINE}</p>
          <p className={styles.lede}>{SITE_DESCRIPTION}</p>
          <div className={styles.actions}>
            <Cta href="/contact?intent=teaming">Partner with us</Cta>
            <Cta href="/capabilities#capability-statement" variant="secondary">
              View capability statement
            </Cta>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What we do</h2>
          <p className={styles.sectionLede}>
            Four focused offerings, each delivered directly by the principal — software built to spec,
            data systems engineered for integrity, and interfaces designed to be accessible.
          </p>
          <div className={`${styles.grid} ${styles.grid3}`}>
            {CAPABILITIES.map((c) => (
              <article key={c.title} className={styles.card}>
                <h3 className={styles.cardTitle}>{c.title}</h3>
                <p className={styles.cardText}>{c.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Credentials &amp; registrations</h2>
          <p className={styles.sectionLede}>
            What the firm holds today, stated plainly. Anything not yet issued is marked as pending —
            never represented as final.
          </p>
          <Credentials />
          <p className={styles.credNote}>
            The CAGE code is pending assignment, and the Unique Entity ID is provided to agencies and
            prime contractors on request.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Who we work with</h2>
          <p className={styles.sectionLede}>
            Two audiences, one accountable point of contact.
          </p>
          <div className={`${styles.grid} ${styles.grid2}`}>
            <article className={styles.path}>
              <h3 className={styles.cardTitle}>Primes &amp; teaming partners</h3>
              <p className={styles.pathText}>
                For prime contractors that need a capable, accountable subcontractor on a federal IT
                effort — full-stack development, database engineering, and accessible UX/UI, delivered
                to spec.
              </p>
              <div className={styles.pathActions}>
                <Cta href="/contact?intent=teaming">Partner with us</Cta>
              </div>
            </article>
            <article className={styles.path}>
              <h3 className={styles.cardTitle}>Government &amp; agencies</h3>
              <p className={styles.pathText}>
                For contracting officers and program staff evaluating the firm. We will share a summary
                of capabilities and our registration details for your review.
              </p>
              <div className={styles.pathActions}>
                <Cta href="/contact?intent=agency" variant="secondary">
                  Request capabilities
                </Cta>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.principal}>
            <span className={styles.avatar} aria-hidden="true">
              TB
            </span>
            <div>
              <h2 className={styles.sectionTitle}>{PRINCIPAL.name}</h2>
              <p className={styles.cardText}>{PRINCIPAL.title}</p>
              <p className={styles.pathText}>
                Timothy Burger personally designs and builds every engagement. That single line of
                accountability — one owner who writes the code, owns the data model, and answers for the
                outcome — is the firm&rsquo;s strongest, most honest trust signal.
              </p>
              <div className={styles.pathActions}>
                <Cta href="/about" variant="secondary">
                  More about the principal
                </Cta>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
