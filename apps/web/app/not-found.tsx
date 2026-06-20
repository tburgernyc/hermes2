import Link from "next/link";
import type { JSX } from "react";

import { PublicShell } from "@/components/ui/console";

/**
 * Custom 404, studio-styled via PublicShell (CSS Modules, no inline styles). Replaces Next's default
 * not-found page — whose un-nonced inline styles would be blocked by the strict style-src (PR D).
 */
export default function NotFound(): JSX.Element {
  return (
    <PublicShell width="narrow">
      <h1>Page not found</h1>
      <p>The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.</p>
      <p>
        <Link href="/">Return to the homepage</Link>
      </p>
    </PublicShell>
  );
}
