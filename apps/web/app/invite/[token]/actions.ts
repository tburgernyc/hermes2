"use server";

/**
 * acceptInvite — the PUBLIC VENDOR_INVITE onboarding write (CLAUDE.md §7). There is no session yet, so
 * the signed token IS the authorization. It is safe ONLY because of what it does NOT trust:
 *   • org + vendor come from the SERVER-VERIFIED token, never from the form.
 *   • the new user's role is HARDCODED 'VENDOR' — an invite can never mint an admin.
 *   • the invited email is read from the stored invite row, not the form (a tampered read-only field
 *     in the page has no effect).
 *   • the invite is single-use: a conditional `accepted_at IS NULL` claim consumes exactly the pending
 *     row, and the users_email_lower_key unique index is the second guard against a double-accept.
 *
 * DB ROLE (deliberate): this runs under withOrg → hermes_app, NOT the least-privilege hermes_token used by
 * the sibling public /quote + /optout paths. Those only write a prospect-scoped row; onboarding must SELECT
 * vendor_invites and INSERT a users row, neither of which hermes_token is granted. The blast radius is thus
 * wider than the token paths, so the safety here is the four structural belts above PLUS the DB CHECKs
 * (users_vendor_link_role, the org tenant_isolation WITH CHECK, the composite vendor FK) proven in
 * negative.vendor-invite.test.ts — the form only ever carries token + password, never a column/table.
 * FOLLOW-UP (hardening): a dedicated least-privilege `hermes_onboarding` role (SELECT/UPDATE vendor_invites +
 * INSERT users/audit_log only, mirroring 0006 hermes_token) would restore the role-per-boundary structural
 * backstop; deferred to keep this PR scoped — the path is not exploitable as written.
 *
 * Everything — create user, claim invite, audit — is one atomic transaction; any failure rolls the whole
 * thing back. The result is surfaced via a redirect status (no JS required).
 */
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { TokenError, hashPassword, hashToken, verifyToken } from "@hermes/core";
import { and, eq, isNull, users, vendorInvites, withOrg } from "@hermes/db";
import { writeAudit } from "@hermes/inngest";

import { clientKey, rateLimit } from "@/lib/rate-limit";

const passwordSchema = z.string().min(12).max(200);

/** Extract a Postgres SQLSTATE, unwrapping drizzle's DrizzleQueryError (the pg error is on `.cause`). */
function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { code?: string }).code;
  if (typeof direct === "string") return direct;
  const cause = (err as { cause?: { code?: string } }).cause;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

export async function acceptInvite(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const hdrs = await headers();
  let status = "accepted";

  if (!rateLimit(clientKey(hdrs.get("fly-client-ip"), hdrs.get("x-forwarded-for"), "invite"))) {
    redirect(`/invite/${encodeURIComponent(token)}?status=throttled`);
  }

  try {
    // 1. Authorize: re-verify the signed token server-side for THIS purpose. verifyToken guarantees a
    //    vendor scope for VENDOR_INVITE, but assert it so payload.vendor narrows to a string.
    const payload = verifyToken(token, "VENDOR_INVITE");
    if (!payload.vendor) throw new TokenError("missing vendor scope");

    // 2. Validate the chosen password (and the confirm match) — never trust raw input.
    const password = passwordSchema.parse(formData.get("password"));
    if (password !== String(formData.get("confirmPassword") ?? "")) throw new z.ZodError([]);

    const passwordHash = await hashPassword(password);
    const userId = randomUUID(); // app-side id (uniform with the tokenized path)
    const tokenHash = hashToken(token);

    await withOrg(payload.org, async (tx) => {
      // Find the still-pending invite for THIS exact token (jti + hash). Unused + same org.
      const inviteRows = await tx
        .select({ id: vendorInvites.id, invitedEmail: vendorInvites.invitedEmail })
        .from(vendorInvites)
        .where(
          and(
            eq(vendorInvites.orgId, payload.org),
            eq(vendorInvites.tokenJti, payload.jti),
            eq(vendorInvites.tokenHash, tokenHash),
            isNull(vendorInvites.acceptedAt),
          ),
        )
        .limit(1);
      const invite = inviteRows[0];
      if (!invite) throw new Error("invite not found or already used");

      // Create the vendor-account user PRE-LINKED to the token's vendor. role + email + vendor are all
      // server-derived (token / stored invite), never the client (§7).
      await tx.insert(users).values({
        id: userId,
        orgId: payload.org,
        email: invite.invitedEmail,
        role: "VENDOR",
        passwordHash,
        vendorId: payload.vendor,
        isActive: true,
      });

      // Single-use claim: consume ONLY the still-pending row. A concurrent accept matches 0 rows → throw.
      const claimed = await tx
        .update(vendorInvites)
        .set({ acceptedAt: new Date(), acceptedUserId: userId })
        .where(
          and(
            eq(vendorInvites.orgId, payload.org),
            eq(vendorInvites.id, invite.id),
            isNull(vendorInvites.acceptedAt),
          ),
        )
        .returning({ id: vendorInvites.id });
      if (claimed.length === 0) throw new Error("invite already used");

      await writeAudit(tx, {
        orgId: payload.org,
        actorType: "VENDOR",
        actorUserId: userId,
        actorEmail: invite.invitedEmail,
        action: "VENDOR_INVITE_ACCEPTED",
        entityType: "users",
        entityId: userId,
      });
    });
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === "23505") status = "exists"; // users_email_lower_key — an account already uses this email
    else if (err instanceof TokenError) status = "invalid";
    else if (err instanceof z.ZodError) status = "weakpw";
    else if (
      err instanceof Error &&
      (err.message.includes("already used") || err.message.includes("not found"))
    ) {
      status = "used";
    } else {
      status = "error";
      console.error("acceptInvite failed", err instanceof Error ? err.message : String(err), code ?? "");
    }
    // All redirects live OUTSIDE the try so Next's NEXT_REDIRECT control-flow is never swallowed.
    redirect(`/invite/${encodeURIComponent(token)}?status=${status}`);
  }

  redirect(`/login?status=accepted`);
}
