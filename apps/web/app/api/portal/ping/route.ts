import { NextResponse } from "next/server";

import { assertSameOrigin, AuthError } from "@hermes/core";

import { requireVendor } from "@/lib/auth-guard";

/**
 * Representative authenticated, same-origin-guarded mutation Route Handler. Unlike Server Actions,
 * raw Route Handlers have no built-in CSRF protection — so this enforces same-origin FIRST, then the
 * vendor session. It is the target of the cross-origin-POST rejection test (CLAUDE.md §7).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
    await requireVendor();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
