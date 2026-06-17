import type { Metadata } from "next";
import type { JSX } from "react";

import { LEGAL_NAME } from "@/lib/site";

import { Cta } from "../_components/Cta";
import styles from "../_components/marketing.module.css";

// Dynamic (not static): the per-request CSP nonce from middleware requires per-request rendering. (7b)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of the BurgerGov website, including disclaimers, intellectual property, " +
    "and limitation of liability.",
};

/**
 * Terms ("/terms"). Modest and truthful. Governing law is stated generically (the firm's state of
 * organization) — NOT a fabricated specific state (truthfulness contract). "Last updated" is a hardcoded
 * string (no new Date()) so the page stays static.
 */
export default function TermsPage(): JSX.Element {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1>Terms of Service</h1>
          <p className={styles.lede}>
            The terms below govern your use of this website. Please read them before relying on anything
            here.
          </p>
          <p className={styles.cardText}>Last updated: June 2026</p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.prose}>
            <p>
              These terms apply to your use of the website operated by {LEGAL_NAME} (&ldquo;we&rdquo;). By
              using this site, you agree to them.
            </p>

            <h2>Use of this site</h2>
            <p>
              You may use this site for lawful, informational purposes. You agree not to misuse it,
              interfere with its operation, or attempt to access areas you are not authorized to use.
            </p>

            <h2>No professional advice &amp; no warranties</h2>
            <p>
              The content on this site is provided for general information only and is not legal,
              financial, or other professional advice. The site is provided &ldquo;as is&rdquo; and
              &ldquo;as available,&rdquo; without warranties of any kind, express or implied.
            </p>

            <h2>Intellectual property</h2>
            <p>
              The content, design, and materials on this site are owned by {LEGAL_NAME} and are protected
              by applicable intellectual-property laws. You may not copy or reuse them without permission,
              except as allowed by law.
            </p>

            <h2>Vendor portal</h2>
            <p>
              Our vendor portal is a separate, invite-only system for vetted subcontractors. Access to it
              is governed by the separate agreements entered into with those subcontractors, not by these
              terms.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, {LEGAL_NAME} will not be liable for any indirect,
              incidental, or consequential damages arising out of your use of, or inability to use, this
              site.
            </p>

            <h2>Governing law</h2>
            <p>
              These terms are governed by the laws of the state in which {LEGAL_NAME} is organized,
              without regard to its conflict-of-laws principles.
            </p>

            <h2>Changes to these terms</h2>
            <p>
              We may update these terms from time to time. The &ldquo;last updated&rdquo; date above
              reflects the current version, and your continued use of the site means you accept the
              updated terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms can be sent to us through our contact form.
            </p>

            <div className={styles.pathActions}>
              <Cta href="/contact">Contact us</Cta>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
