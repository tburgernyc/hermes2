import type { JSX, ReactNode } from "react";

import styles from "./_components/marketing.module.css";
import { SiteFooter } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";

/**
 * Public marketing shell. Wraps every (marketing) page in the shared header/footer chrome with a
 * keyboard skip-link and a single <main id="main"> landmark. This route group sits OUTSIDE the
 * /admin|/portal middleware matcher, so these pages are fully public (no auth). No DB/AI imports here.
 *
 * The .shell wrapper carries the premium light-"studio" palette + background (Phase 8) and SCOPES it to
 * the marketing tree — admin/portal chrome keeps the default --color-* tokens.
 */
export default function MarketingLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
