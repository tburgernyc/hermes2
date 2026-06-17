import type { MetadataRoute } from "next";

import { DOMAIN } from "@/lib/site";

/** Allow crawling the public marketing site; keep the authed + API surfaces out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/portal", "/dashboard", "/api"],
    },
    sitemap: `https://${DOMAIN}/sitemap.xml`,
  };
}
