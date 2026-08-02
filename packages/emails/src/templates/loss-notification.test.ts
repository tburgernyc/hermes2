/**
 * Proves the §7 autoescaping guarantee for the loss-notification template: an untrusted company name
 * (vendor/prospect-derived) is HTML-escaped, never emitted as live markup.
 */
import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { LossNotificationEmail } from "./LossNotificationEmail.js";

describe("LossNotificationEmail autoescaping (CLAUDE.md §7)", () => {
  it("escapes an untrusted company name and includes the solicitation title", async () => {
    const html = await render(
      createElement(LossNotificationEmail, {
        to: "prospect@example.test",
        companyName: "<script>alert('xss')</script>",
        solicitationTitle: "IT Support Services <b>RFQ</b>",
      }),
    );

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>RFQ</b>");
    expect(html).toContain("&lt;b&gt;RFQ&lt;/b&gt;");
    expect(html).toContain("was not selected");
  });
});
