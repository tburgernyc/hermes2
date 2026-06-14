import { describe, expect, it } from "vitest";

import { SITE_TITLE } from "@/lib/site";

// Smoke test for the web app. Imports a plain-TS module (no JSX) so it runs
// under the node Vitest environment without a React/JSX transform.
describe("web app site config", () => {
  it("exposes the Hermes 2.0 title", () => {
    expect(SITE_TITLE).toBe("Hermes 2.0");
  });
});
