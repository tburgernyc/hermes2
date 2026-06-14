import type { JSX } from "react";

import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}): Promise<JSX.Element> {
  const { error } = await searchParams;
  return (
    <main>
      <h1>Sign in</h1>
      {error ? <p role="alert">Invalid email or password.</p> : null}
      <form action={loginAction}>
        <label>
          Email
          <input type="email" name="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
