import type { JSX, ReactNode } from "react";

import { SiteFooter } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";

/**
 * Public marketing shell. Wraps every (marketing) page in the shared header/footer chrome with a
 * keyboard skip-link and a single <main id="main"> landmark. This route group sits OUTSIDE the
 * /admin|/portal middleware matcher, so these pages are fully public (no auth). No DB/AI imports here.
 */
export default function MarketingLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
