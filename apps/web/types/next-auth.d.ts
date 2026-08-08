import type { DefaultSession } from "next-auth";
import type { Role } from "@hermes/core";
import type { AdminRole } from "@/lib/admin-domains";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: Role;
      /** Server-resolved vetted-vendor link (null for admins / not-yet-linked vendors). */
      vendorId: string | null;
      /** §3.6 granular admin access level (null for a VENDOR-role session). */
      adminRole: AdminRole | null;
      totpVerified: boolean;
      totpEnrolled: boolean;
    } & DefaultSession["user"];
  }

  /** Extra fields returned by the Credentials `authorize` callback. */
  interface User {
    orgId?: string;
    role?: Role;
    vendorId?: string | null;
    adminRole?: AdminRole | null;
    totpEnrolled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string;
    role?: Role;
    vendorId?: string | null;
    adminRole?: AdminRole | null;
    totpVerified?: boolean;
    totpEnrolled?: boolean;
  }
}
