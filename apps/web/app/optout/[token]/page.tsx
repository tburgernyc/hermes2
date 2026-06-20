/**
 * /optout/[token] — the PUBLIC, no-account opt-out page. Not under the /admin|/portal middleware; the
 * signed OPT_OUT token is the authorization, re-verified here and again in the optOut action.
 */
import type { JSX } from "react";

import { TokenError, verifyToken } from "@hermes/core";

import { Card, PublicShell } from "@/components/ui/console";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

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
        <PublicShell width="narrow">
          <h1>This link is no longer valid</h1>
          <p>The opt-out link is invalid or has expired.</p>
        </PublicShell>
      );
    }
    throw err;
  }

  if (status === "done") {
    return (
      <PublicShell width="narrow">
        <h1>You have opted out</h1>
        <p>You will no longer receive outreach about this opportunity. Thank you.</p>
      </PublicShell>
    );
  }

  return (
    <PublicShell width="narrow">
      <h1>Opt out of outreach</h1>
      {status === "error" || status === "invalid" ? (
        <Alert>We couldn&rsquo;t process that request. Please try again.</Alert>
      ) : null}
      {status === "throttled" ? (
        <Alert>Too many attempts. Please wait a minute and try again.</Alert>
      ) : null}
      <Card>
        <p>Confirm that you no longer wish to receive outreach about this opportunity.</p>
        <form action={optOut}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" variant="secondary">
            Opt out
          </Button>
        </form>
      </Card>
    </PublicShell>
  );
}
