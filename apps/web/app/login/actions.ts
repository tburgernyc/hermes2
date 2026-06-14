"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";

/**
 * Password login. On success `signIn` throws NEXT_REDIRECT to /dashboard (the role router); a bad
 * credential is an AuthError, which we turn into a redirect back to /login with an error flag. The
 * non-AuthError re-throw lets the success redirect propagate.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=1");
    throw error;
  }
}
