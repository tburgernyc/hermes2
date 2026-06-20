import type { JSX } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Alert } from "@/components/ui/Alert";
import { AuthScreen } from "@/components/ui/AuthScreen";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

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
      title="Two-factor verification"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      {error === "throttled" ? (
        <Alert>Too many attempts. Please wait a few minutes and try again.</Alert>
      ) : error ? (
        <Alert>Invalid code. Try again.</Alert>
      ) : null}
      <form action={verifyTotpAction}>
        <Field label="Code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
        <Button type="submit" block>
          Verify
        </Button>
      </form>
    </AuthScreen>
  );
}
