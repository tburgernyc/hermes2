"use server";

import { redirect } from "next/navigation";

import { clearFailedLogins, isLockedOut, recordFailedLogin } from "@hermes/core";

import { auth, updateTotp } from "@/auth";

/**
 * Step-up verification. updateTotp triggers the jwt callback, which verifies the code SERVER-side
 * against the stored secret and only then sets totpVerified=true. We branch on the returned session.
 *
 * Brute-force defense on the second factor reuses the SAME DB-durable lockout as the password path
 * (recordFailedLogin locks the account for the configured window at MAX_FAILED). Only FAILED codes count;
 * a correct code clears the counter. This is durable + consistent across instances/restarts — an
 * in-memory per-process limiter would hand a distributed/restarting attacker fresh guesses per machine,
 * and, unlike a fixed attempt cap, it never throttles the many SUCCESSFUL re-submits the e2e cold-start
 * warmup makes (only wrong codes count).
 */
export async function verifyTotpAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  if (await isLockedOut(userId)) redirect("/admin/totp?error=throttled");

  const code = String(formData.get("code") ?? "").trim();
  const updated = await updateTotp({ totpCode: code });
  if (updated?.user?.totpVerified) {
    await clearFailedLogins(userId);
    redirect("/admin");
  }
  await recordFailedLogin(userId);
  redirect("/admin/totp?error=1");
}
