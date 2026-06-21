import type { JSX } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Alert } from "@/components/ui/Alert";
import { AuthLink, AuthNote, AuthScreen } from "@/components/ui/AuthScreen";
import { Button } from "@/components/ui/Button";
import { TotpInput } from "@/components/ui/TotpInput";

import { verifyTotpAction } from "./actions";

/** TOTP step-up: an enrolled admin proves the second factor before /admin opens. */
export default async function TotpStepUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/portal");
  if (!session.user.totpEnrolled) redirect("/admin/totp/enroll");
  if (session.user.totpVerified) redirect("/admin");

  const { error } = await searchParams;
  return (
    <AuthScreen
      badge="Step 2 · One-time passcode"
      title="Enter your code"
      subtitle="Enter the 6-digit code from your authenticator app, then select Verify."
      quote="Zero-trust access. Six digits stand between intent and the console."
      asideTag="TOTP verification"
    >
      {error === "throttled" ? (
        <Alert>Too many attempts. Please wait a few minutes and try again.</Alert>
      ) : error ? (
        <Alert>Invalid code. Try again.</Alert>
      ) : null}
      <form action={verifyTotpAction}>
        <TotpInput name="code" />
        <Button type="submit" block>
          Verify
        </Button>
      </form>
      <AuthNote>
        First time? <AuthLink href="/admin/totp/enroll">Set up two-factor →</AuthLink>
      </AuthNote>
    </AuthScreen>
  );
}
