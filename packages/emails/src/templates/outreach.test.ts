/**
 * Proves the §7 autoescaping guarantee: untrusted prospect/body content rendered into the outreach
 * template is HTML-escaped, never emitted as live markup. Uses createElement (no JSX) so the test needs
 * no extra esbuild/jsx config.
 */
import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { OutreachEmail } from "./OutreachEmail.js";

describe("OutreachEmail autoescaping (CLAUDE.md §7)", () => {
  it("escapes untrusted content and includes the signed opt-out + quote links", async () => {
    const html = await render(
      createElement(OutreachEmail, {
        to: "vendor@example.test",
        subject: "Opportunity",
        prospectName: "<script>alert('xss')</script>",
        bodyText: "First paragraph.\n<img src=x onerror=alert(1)>",
        quoteUrl: "https://burgergov.com/quote/abc.def",
        optoutUrl: "https://burgergov.com/optout/ghi.jkl",
      }),
    );

    // The injected <script> is escaped to entities, not emitted as a live tag.
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    // The signed links survive intact.
    expect(html).toContain("https://burgergov.com/quote/abc.def");
    expect(html).toContain("https://burgergov.com/optout/ghi.jkl");
  });
});
