import type { JSX } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

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
    <main>
      <h1>Two-factor verification</h1>
      <p>Enter the 6-digit code from your authenticator app.</p>
      {error === "throttled" ? (
        <p role="alert">Too many attempts. Please wait a few minutes and try again.</p>
      ) : error ? (
        <p role="alert">Invalid code. Try again.</p>
      ) : null}
      <form action={verifyTotpAction}>
        <label>
          Code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <button type="submit">Verify</button>
      </form>
    </main>
  );
}
