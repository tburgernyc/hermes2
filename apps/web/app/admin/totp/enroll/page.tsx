import type { JSX } from "react";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { encryptSecret, generateTotpSecret, setTotpSecretCiphertext, totpKeyUri } from "@hermes/core";

import { auth } from "@/auth";

import { confirmEnrollAction } from "./actions";

/**
 * First-time admin TOTP enrollment. Generates + persists a fresh secret for this attempt, then shows
 * its QR (and the manual key) so the admin can confirm with a live code. The plaintext secret is the
 * admin's own and is never stored in plaintext (only the AES-GCM ciphertext is persisted).
 */
export default async function TotpEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/portal");
  if (session.user.totpEnrolled) redirect("/admin/totp");

  const secret = generateTotpSecret();
  await setTotpSecretCiphertext(session.user.orgId, session.user.id, encryptSecret(secret));
  const otpauth = totpKeyUri(session.user.email ?? "admin", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  const { error } = await searchParams;

  return (
    <main>
      <h1>Set up two-factor authentication</h1>
      <p>Scan this QR code with your authenticator app, then enter the current code to confirm.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="TOTP enrollment QR code" width={200} height={200} />
      <p>
        Or enter this key manually: <code>{secret}</code>
      </p>
      {error ? <p role="alert">That code didn&apos;t match. Scan again and retry.</p> : null}
      <form action={confirmEnrollAction}>
        <label>
          Code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <button type="submit">Confirm</button>
      </form>
    </main>
  );
}
