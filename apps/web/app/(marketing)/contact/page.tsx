import type { Metadata } from "next";
import type { JSX } from "react";

import { PlaceholderBadge } from "../_components/PlaceholderBadge";
import marketing from "../_components/marketing.module.css";
import { submitInquiry } from "./actions";
import styles from "./contact.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach out about a teaming opportunity or a capability need. Every message reaches the principal directly.",
};

const STATUS_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  sent: { text: "Thanks — your message was received. We'll be in touch.", ok: true },
  invalid: { text: "Please check your details and try again.", ok: false },
  throttled: { text: "Too many submissions. Please wait a minute and try again.", ok: false },
  error: { text: "Something went wrong on our end. Please try again.", ok: false },
};

function resolveDefaultIntent(intent: string): "TEAMING" | "AGENCY" | "OTHER" {
  if (intent === "agency") return "AGENCY";
  if (intent === "teaming") return "TEAMING";
  return "OTHER";
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; status?: string }>;
}): Promise<JSX.Element> {
  const params = await searchParams;
  const defaultIntent = resolveDefaultIntent((params.intent ?? "").toLowerCase());
  const status = params.status ? STATUS_MESSAGES[params.status] : undefined;

  return (
    <>
      <header className={marketing.pageHeader}>
        <div className={marketing.pageHeaderInner}>
          <h1>Contact</h1>
          <p className={marketing.lede}>
            Tell us about your teaming opportunity or capability need. We read every message and
            respond personally.
          </p>
        </div>
      </header>

      <section className={marketing.section}>
        <div className={marketing.container}>
          <div className={styles.layout}>
            <div>
              {status ? (
                <p
                  className={`${styles.banner} ${status.ok ? styles.ok : styles.err}`}
                  data-testid="contact-status"
                  role="status"
                >
                  {status.text}
                </p>
              ) : null}

              <form action={submitInquiry} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" required maxLength={200} autoComplete="name" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={320}
                    autoComplete="email"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="company">
                    Organization <span className={styles.optional}>(optional)</span>
                  </label>
                  <input id="company" name="company" maxLength={200} autoComplete="organization" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="intent">I&rsquo;m reaching out as</label>
                  <select id="intent" name="intent" defaultValue={defaultIntent}>
                    <option value="TEAMING">A prime / teaming partner</option>
                    <option value="AGENCY">A government agency / contracting officer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="message">Message</label>
                  <textarea id="message" name="message" required maxLength={5000} rows={6} />
                </div>
                <button type="submit" className={styles.submit}>
                  Send message
                </button>
              </form>
            </div>

            <aside className={styles.aside}>
              <h2 className={styles.asideTitle}>Direct contact</h2>
              <p className={marketing.cardText}>
                Direct email and phone <PlaceholderBadge>published at launch</PlaceholderBadge>. Until
                then, the form reaches the principal directly.
              </p>
              <p className={marketing.cardText}>
                Agencies: a capability summary is available on request.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
