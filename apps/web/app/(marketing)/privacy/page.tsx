import type { Metadata } from "next";
import type { JSX } from "react";

import { LEGAL_NAME } from "@/lib/site";

import { Cta } from "../_components/Cta";
import styles from "../_components/marketing.module.css";

// Dynamic (not static): the per-request CSP nonce from middleware requires per-request rendering. (7b)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BurgerGov collects, uses, and protects the limited information submitted through this site, " +
    "and your choices regarding it.",
};

/**
 * Privacy ("/privacy"). A modest, truthful small-business policy. Every statement true today — the only
 * personal data collected is what a visitor submits through the contact form, plus basic server logs.
 * "Last updated" is a hardcoded string (no new Date()) so the page stays static.
 */
export default function PrivacyPage(): JSX.Element {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1>Privacy Policy</h1>
          <p className={styles.lede}>
            We collect only what we need to respond to you, and we explain plainly how it is used.
          </p>
          <p className={styles.cardText}>Last updated: June 2026</p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.prose}>
            <p>
              This policy describes how {LEGAL_NAME} (&ldquo;we&rdquo;) handles information in connection
              with this website.
            </p>

            <h2>Information we collect</h2>
            <p>
              When you use our contact form, we collect the information you provide: your name, email
              address, company (if given), and the contents of your message. Our servers also keep basic
              technical logs — such as IP address, request timestamps, and pages requested — as part of
              normal operation and security.
            </p>

            <h2>How we use it</h2>
            <p>
              We use the information you submit to respond to your inquiry and to follow up about a
              potential engagement. We do not sell personal information, and we do not share it except as
              needed to operate this site or to comply with the law.
            </p>

            <h2>Email &amp; CAN-SPAM</h2>
            <p>
              Any outreach email we send includes a clear way to opt out or unsubscribe, along with our
              physical mailing address, in keeping with the CAN-SPAM Act. If you opt out, we will stop
              sending you that outreach.
            </p>

            <h2>Data retention &amp; security</h2>
            <p>
              We keep submitted information only as long as needed to respond and to maintain our
              records, and we apply reasonable administrative and technical safeguards to protect it. No
              method of transmission or storage is perfectly secure, and we cannot guarantee absolute
              security.
            </p>

            <h2>Your choices &amp; contacting us</h2>
            <p>
              You can ask us to access or delete the information you have submitted, or ask a question
              about this policy, by reaching us through our contact form. Our mailing address is shown in
              the site footer.
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
