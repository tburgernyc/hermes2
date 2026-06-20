import type { JSX } from "react";
import QRCode from "qrcode";
import { redirect } from "next/navigation";

import { encryptSecret, generateTotpSecret, setTotpSecretCiphertext, totpKeyUri } from "@hermes/core";

import { auth } from "@/auth";
import { Alert } from "@/components/ui/Alert";
import { AuthScreen } from "@/components/ui/AuthScreen";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { confirmEnrollAction } from "./actions";
import styles from "./enroll.module.css";

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
    <AuthScreen title="Set up two-factor authentication">
      <p className={styles.hint}>
        Scan this QR code with your authenticator app, then enter the current code to confirm.
      </p>
      <div className={styles.qr}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="TOTP enrollment QR code" width={180} height={180} />
      </div>
      <p className={styles.hint}>
        Or enter this key manually: <code className={styles.key}>{secret}</code>
      </p>
      {error ? <Alert>That code didn&apos;t match. Scan again and retry.</Alert> : null}
      <form action={confirmEnrollAction}>
        <Field label="Code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
        <Button type="submit" block>
          Confirm
        </Button>
      </form>
    </AuthScreen>
  );
}
