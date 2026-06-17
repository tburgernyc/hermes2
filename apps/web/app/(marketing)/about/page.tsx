import type { Metadata } from "next";
import type { JSX } from "react";

import { PRINCIPAL, PRINCIPAL_STACK } from "@/lib/site";

import { Cta } from "../_components/Cta";
import { PlaceholderBadge } from "../_components/PlaceholderBadge";
import styles from "../_components/marketing.module.css";

// Dynamic (not static): the per-request CSP nonce from middleware requires per-request rendering. (7b)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "Founder-led by Timothy Burger — full-stack engineering, database systems, and accessible UX/UI " +
    "design, with a regulated-industry and ecommerce delivery background applied honestly to federal work.",
};

/**
 * About ("/about"). Leads with the principal's technical depth and his regulated-industry + ecommerce
 * background — framed HONESTLY as the source of compliance-minded, data-sensitive, accountable instincts
 * for federal work, NOT as federal past performance the firm does not yet have (truthfulness contract).
 */
export default function AboutPage(): JSX.Element {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1>About</h1>
          <p className={styles.lede}>
            BurgerGov is founder-led. One accountable owner designs and builds every engagement, and
            answers for the outcome.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.prose}>
            <div className={styles.principal}>
              <span className={styles.avatar} aria-hidden="true">
                TB
              </span>
              <div>
                <h2 className={styles.sectionTitle}>{PRINCIPAL.name}</h2>
                <p className={styles.cardText}>{PRINCIPAL.title}</p>
                <PlaceholderBadge>Photo coming soon</PlaceholderBadge>
              </div>
            </div>

            <p>
              Timothy Burger is a full-stack engineer and designer. He builds across Python,
              JavaScript/TypeScript, Rust, Solidity, and HTML/CSS, engineers the database systems behind
              the applications he ships, and brings years of UX/UI design practice to making those
              systems usable and accessible.
            </p>

            <ul className={styles.tagList}>
              {PRINCIPAL_STACK.map((tech) => (
                <li key={tech} className={styles.tag}>
                  {tech}
                </li>
              ))}
            </ul>

            <h2>The right instincts for federal work</h2>
            <p>
              Much of that work has been for regulated industries — legal and medical — and for
              ecommerce. Those domains demand compliance awareness, careful handling of sensitive data,
              and clear accountability for what ships. That experience is not federal past performance,
              and we do not present it as such. It is, honestly, the source of the instincts federal IT
              work rewards: build to spec, respect the data, and stand behind the result.
            </p>

            <h2>How we work</h2>
            <p>
              We work in a disciplined, transparent way: scope agreed in writing, compliance considered
              from the first line of code, and one accountable owner you can reach throughout. No
              hand-offs to anonymous teams, and no claims we cannot stand behind.
            </p>

            <div className={styles.pathActions}>
              <Cta href="/contact">Get in touch</Cta>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
