"use client";

import * as Sentry from "@sentry/nextjs";
import type { JSX } from "react";
import { useEffect } from "react";

import styles from "./global-error.module.css";

/**
 * Root error boundary. Replaces Next's default (inline-styled) error page — required to keep the strict
 * style-src (PR D) clean — and reports the error to Sentry (resolves the build's global-error warning).
 * It renders its own <html>/<body> because it stands in for the root layout when that layout errors.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }): JSX.Element {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={styles.body}>
        <div className={styles.card}>
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.text}>
            An unexpected error occurred. Please refresh the page or try again shortly.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root
              layout after a crash; a hard <a> reload is intentional (the router context may be gone). */}
          <a className={styles.link} href="/">
            Return to the homepage
          </a>
        </div>
      </body>
    </html>
  );
}
