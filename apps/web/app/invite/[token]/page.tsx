/**
 * /invite/[token] — the PUBLIC vendor-onboarding page. It is TOP-LEVEL (NOT under the /admin|/portal
 * middleware matcher), so an unauthenticated invitee can reach it; the signed token IS the
 * authorization. The token is re-verified here (to render) and again in the acceptInvite action (to
 * write). The email is shown read-only for confirmation only — the action reads it from the stored
 * invite row, never from the form.
 */
import type { JSX } from "react";

import { TokenError, hashToken, verifyToken } from "@hermes/core";
import { and, eq, isNull, vendorInvites, vendors, withOrg } from "@hermes/db";

import { Alert } from "@/components/ui/Alert";
import { AuthScreen } from "@/components/ui/AuthScreen";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { acceptInvite } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_MESSAGE: Record<string, string> = {
  used: "This invitation has already been used.",
  exists: "An account already exists for this email — try signing in instead.",
  weakpw: "Choose a password of at least 12 characters, and make sure both fields match.",
  invalid: "This invitation link is invalid or has expired.",
  throttled: "Too many attempts. Please wait a minute and try again.",
  error: "Something went wrong setting up your account. Please try again.",
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}

function InvalidLink(): JSX.Element {
  return (
    <AuthScreen title="This link is no longer valid">
      <p>
        The invitation may have expired or already been used. Please contact your Burger Consulting
        point of contact for a new one.
      </p>
    </AuthScreen>
  );
}

export default async function InvitePage({ params, searchParams }: PageProps): Promise<JSX.Element> {
  const { token } = await params;
  const { status } = await searchParams;

  let payload;
  try {
    payload = verifyToken(token, "VENDOR_INVITE");
  } catch (err) {
    if (err instanceof TokenError) return <InvalidLink />;
    throw err;
  }

  // Show who the invite is for + which vendor. A used/withdrawn invite resolves to null → invalid page.
  const invite = await withOrg(payload.org, async (tx) => {
    const rows = await tx
      .select({ invitedEmail: vendorInvites.invitedEmail, companyName: vendors.companyName })
      .from(vendorInvites)
      .innerJoin(
        vendors,
        and(eq(vendors.orgId, vendorInvites.orgId), eq(vendors.id, vendorInvites.vendorId)),
      )
      .where(
        and(
          eq(vendorInvites.orgId, payload.org),
          eq(vendorInvites.tokenJti, payload.jti),
          eq(vendorInvites.tokenHash, hashToken(token)),
          isNull(vendorInvites.acceptedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });

  if (!invite) return <InvalidLink />;

  return (
    <AuthScreen
      title="Set up your subcontractor account"
      subtitle={
        <>
          You&apos;ve been invited to access the subcontractor portal for{" "}
          <strong>{invite.companyName}</strong>. Choose a password to finish setting up your account.
        </>
      }
    >
      {status && STATUS_MESSAGE[status] ? <Alert>{STATUS_MESSAGE[status]}</Alert> : null}
      <form action={acceptInvite}>
        <input type="hidden" name="token" value={token} />
        <Field type="email" label="Email" value={invite.invitedEmail} readOnly aria-readonly="true" />
        <Field
          type="password"
          label="Password (at least 12 characters)"
          name="password"
          required
          minLength={12}
          maxLength={200}
        />
        <Field
          type="password"
          label="Confirm password"
          name="confirmPassword"
          required
          minLength={12}
          maxLength={200}
        />
        <Button type="submit" block>
          Create account
        </Button>
      </form>
    </AuthScreen>
  );
}
