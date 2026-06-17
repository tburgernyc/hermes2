import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";

import "./globals.css";
import { BRAND_NAME, DOMAIN, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${DOMAIN}`),
  title: {
    default: SITE_TITLE,
    template: `%s — ${BRAND_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: BRAND_NAME,
    type: "website",
    url: `https://${DOMAIN}`,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
