import type { DefaultSession } from "next-auth";
import type { Role } from "@hermes/core";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: Role;
      totpVerified: boolean;
      totpEnrolled: boolean;
    } & DefaultSession["user"];
  }

  /** Extra fields returned by the Credentials `authorize` callback. */
  interface User {
    orgId?: string;
    role?: Role;
    totpEnrolled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string;
    role?: Role;
    totpVerified?: boolean;
    totpEnrolled?: boolean;
  }
}
