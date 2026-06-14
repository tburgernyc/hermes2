import type { JSX } from "react";

import { requireAdmin } from "@/lib/auth-guard";

/** Admin console landing. Middleware already gates this; requireAdmin is defense in depth. */
export default async function AdminHome(): Promise<JSX.Element> {
  const session = await requireAdmin();
  return (
    <main>
      <h1>Admin Console</h1>
      <p>Signed in as {session.user.email}.</p>
    </main>
  );
}
