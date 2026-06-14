import { redirect } from "next/navigation";

import { auth } from "@/auth";

/** Post-login router: send each authenticated user to their role home. */
export default async function DashboardPage(): Promise<never> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "admin" ? "/admin" : "/portal");
}
