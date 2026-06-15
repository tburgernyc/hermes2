/**
 * /optout/[token] — the PUBLIC, no-account opt-out page. Not under the /admin|/portal middleware; the
 * signed OPT_OUT token is the authorization, re-verified here and again in the optOut action.
 */
import type { JSX } from "react";

import { TokenError, verifyToken } from "@hermes/core";

import { optOut } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function OptOutPage({ params, searchParams }: PageProps): Promise<JSX.Element> {
  const { token } = await params;
  const { status } = await searchParams;

  try {
    verifyToken(token, "OPT_OUT");
  } catch (err) {
    if (err instanceof TokenError) {
      return (
        <main>
          <h1>This link is no longer valid</h1>
          <p>The opt-out link is invalid or has expired.</p>
        </main>
      );
    }
    throw err;
  }

  if (status === "done") {
    return (
      <main>
        <h1>You have opted out</h1>
        <p>You will no longer receive outreach about this opportunity. Thank you.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Opt out of outreach</h1>
      {status === "error" || status === "invalid" ? (
        <p role="alert" style={{ color: "#b00" }}>
          We couldn’t process that request. Please try again.
        </p>
      ) : null}
      {status === "throttled" ? (
        <p role="alert" style={{ color: "#b00" }}>
          Too many attempts. Please wait a minute and try again.
        </p>
      ) : null}
      <p>Confirm that you no longer wish to receive outreach about this opportunity.</p>
      <form action={optOut}>
        <input type="hidden" name="token" value={token} />
        <button type="submit">Opt out</button>
      </form>
    </main>
  );
}
