"use server";

import { redirect } from "next/navigation";
import { decryptSecret, getAuthUserById, markTotpEnrolled, verifyTotpCode } from "@hermes/core";

import { auth, updateTotp } from "@/auth";

/**
 * Confirm enrollment: verify the code against the just-persisted secret FIRST, then mark the user
 * enrolled and elevate the session. A wrong code never marks the user enrolled.
 */
export async function confirmEnrollAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  const session = await auth();
  const sUser = session?.user;
  if (!sUser || sUser.role !== "admin") redirect("/login");

  const user = await getAuthUserById(sUser.orgId, sUser.id);
  const valid =
    user?.totpSecretCiphertext != null &&
    verifyTotpCode(decryptSecret(user.totpSecretCiphertext), code);
  if (!valid) redirect("/admin/totp/enroll?error=1");

  await markTotpEnrolled(sUser.orgId, sUser.id);
  await updateTotp({ totpCode: code, refreshEnrollment: true });
  redirect("/admin");
}
