import type { DefaultSession } from "next-auth";
import type { Role } from "@hermes/core";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: Role;
      /** Server-resolved vetted-vendor link (null for admins / not-yet-linked vendors). */
      vendorId: string | null;
      totpVerified: boolean;
      totpEnrolled: boolean;
    } & DefaultSession["user"];
  }

  /** Extra fields returned by the Credentials `authorize` callback. */
  interface User {
    orgId?: string;
    role?: Role;
    vendorId?: string | null;
    totpEnrolled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string;
    role?: Role;
    vendorId?: string | null;
    totpVerified?: boolean;
    totpEnrolled?: boolean;
  }
}
