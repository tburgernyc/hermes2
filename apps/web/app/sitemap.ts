import type { MetadataRoute } from "next";

import { DOMAIN } from "@/lib/site";

export const dynamic = "force-static";

/** Public marketing routes only — the authed /admin, /portal, token, and API paths are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${DOMAIN}`;
  const routes = ["", "/capabilities", "/about", "/contact", "/privacy", "/terms"];
  return routes.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
