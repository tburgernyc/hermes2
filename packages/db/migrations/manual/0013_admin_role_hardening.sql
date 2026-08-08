-- ============================================================================
-- 0013_admin_role_hardening.sql — DB-level backstop for the §3.6 admin RBAC (decision 4 / the
-- verifier's CRITICAL finding). Runs after 0012. Every statement idempotent.
--
-- WHAT WAS MISSING: §3.6 shipped a server-side-only guard (requireFullAdmin / session claim /
-- middleware redirect) for `orgs.directives` (compliance settings). Spec §3.6 item 2 requires
-- "RLS policy PLUS a server-side check, never a client-side-only hide of a nav link" — decision 4
-- narrowed the DB half to directives/settings writes + financial tables. Nothing DB-level existed:
-- `hermes_app` held unconditional UPDATE on `orgs`, so a bug in the server-side check (or a future
-- code path that forgets to call requireFullAdmin) had NO structural backstop.
--
-- MECHANISM CHOSEN: a session GUC, `app.current_admin_role`, set by the new `client.withOrgAsAdmin`
-- helper (mirrors `withOrg`'s existing set_config pattern) — NOT a dedicated NOLOGIN role like
-- hermes_token/hermes_vendor. hermes_app stays hermes_app; only ONE write path (this table's UPDATE)
-- needs the extra gate today, so a full role-elevation ladder would be disproportionate machinery.
-- See client.ts withOrgAsAdmin for the fail-closed rationale (NULL/'' both deny; only 'FULL' passes).
--
-- SCOPE (orchestrator decision 18f): `orgs` ONLY. invoices / time_entries / contracts /
-- contract_milestones are explicitly OUT of scope for this unit (no writers yet / being given new
-- CAPTURE-guarded paths by a concurrent unit) and are routed to the Wave-2c integration unit.
--
-- WHY THIS IS SAFE: hermes_app is the ONLY role holding UPDATE on `orgs` — hermes_token has
-- SELECT-only (0004) and hermes_vendor is not named on `orgs` at all — so no other write path is
-- affected. `apps/web/app/admin/(console)/settings/actions.ts` is the ONLY caller anywhere in the
-- app that runs `UPDATE orgs` (verified: the only `.update(orgs)` call site in the whole repo), so
-- this policy has exactly one legitimate caller to satisfy, and it now uses withOrgAsAdmin. A
-- RESTRICTIVE policy ANDs with the existing `orgs_tenant_isolation` PERMISSIVE policy (0003) — this
-- only NARROWS an org-scoped UPDATE, never widens it, and does not touch SELECT/INSERT/DELETE.
-- ============================================================================

DROP POLICY IF EXISTS orgs_update_requires_full_admin ON orgs;
CREATE POLICY orgs_update_requires_full_admin ON orgs
  AS RESTRICTIVE FOR UPDATE TO hermes_app
  USING (current_setting('app.current_admin_role', true) = 'FULL')
  WITH CHECK (current_setting('app.current_admin_role', true) = 'FULL');
