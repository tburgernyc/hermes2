"use server";

import { redirect } from "next/navigation";

import { updateTotp } from "@/auth";

/**
 * Step-up verification. updateTotp triggers the jwt callback, which verifies the code SERVER-side
 * against the stored secret and only then sets totpVerified=true. We branch on the returned session.
 */
export async function verifyTotpAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  const session = await updateTotp({ totpCode: code });
  redirect(session?.user?.totpVerified ? "/admin" : "/admin/totp?error=1");
}
