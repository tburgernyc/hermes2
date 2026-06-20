import type { JSX } from "react";

import { Alert } from "@/components/ui/Alert";
import { AuthScreen } from "@/components/ui/AuthScreen";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}): Promise<JSX.Element> {
  const { error } = await searchParams;
  return (
    <AuthScreen title="Sign in" subtitle="Access the BurgerGov console or subcontractor portal.">
      {error ? <Alert>Invalid email or password.</Alert> : null}
      <form action={loginAction}>
        <Field label="Email" name="email" type="email" autoComplete="username" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" block>
          Sign in
        </Button>
      </form>
    </AuthScreen>
  );
}
