/**
 * Tokenized-submission negatives (CLAUDE.md §7), complementing negative.tenant-boundary.test.ts:
 *   • token_jti REPLAY — a second prospect quote reusing the same (org_id, token_jti) is rejected by the
 *     partial unique index, so one signed invitation can mint at most one quote.
 *   • token AUDIT — hermes_token may APPEND an audit row (the path submitQuote/optOut rely on, granted by
 *     0007) but may NOT alter or erase one (no UPDATE/DELETE grant + the append-only triggers).
 *
 * (Purpose-crossing — an OPT_OUT token rejected for a quote and vice-versa — is enforced by
 * verifyToken's purpose check and proven in packages/core tokens.test.ts. The oversized/non-PDF upload
 * rejections are proven in packages/core upload.test.ts. Those gates live above the DB and are unit-tested
 * there; this file covers the DB-enforced halves.)
 */
import { describe, expect, it } from "vitest";

import {
  HAS_DB,
  PG,
  capturePgError,
  setLocalRole,
  setOrgContext,
  withRollback,
} from "./helpers/db.js";
import { insertOrg, insertProspect, insertSolicitation } from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

d("tokenized submission — replay + audit", () => {
  it("rejects a replayed token_jti: two prospect quotes with the same (org_id, token_jti)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const prospectId = await insertProspect(c, orgId);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);

      // First submission with this token's jti succeeds.
      await expect(
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, prospect_id, token_jti)
           VALUES ($1, $2, $3, 'jti-replay-1')`,
          [orgId, solId, prospectId],
        ),
      ).resolves.toBeDefined();

      // Re-using the SAME jti (a replayed link) is blocked by the partial unique index.
      const err = await capturePgError(() =>
        c.query(
          `INSERT INTO vendor_quotes (org_id, solicitation_id, prospect_id, token_jti)
           VALUES ($1, $2, $3, 'jti-replay-1')`,
          [orgId, solId, prospectId],
        ),
      );
      expect(err?.code).toBe(PG.UNIQUE_VIOLATION);
    }));

  it("allows distinct jtis (the guard keys on the jti, not the prospect)", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId);
      const prospectId = await insertProspect(c, orgId);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);
      for (const jti of ["jti-a", "jti-b"]) {
        await expect(
          c.query(
            `INSERT INTO vendor_quotes (org_id, solicitation_id, prospect_id, token_jti)
             VALUES ($1, $2, $3, $4)`,
            [orgId, solId, prospectId, jti],
          ),
        ).resolves.toBeDefined();
      }
    }));

  it("hermes_token CAN insert a line item (the BEFORE-INSERT sync trigger runs SECURITY DEFINER)", () =>
    withRollback(async (c) => {
      // Regression guard for 0008: the line-item trigger reads vendor_quotes, on which hermes_token has
      // INSERT-but-not-SELECT. Without SECURITY DEFINER the trigger's own read is denied and the whole
      // tokenized submission rolls back.
      const orgId = await insertOrg(c);
      const solId = await insertSolicitation(c, orgId, { contractType: "TM" });
      const prospectId = await insertProspect(c, orgId);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);

      // Supply the quote id app-side (no RETURNING) — exactly as submitQuote does, because hermes_token
      // has INSERT but not SELECT on vendor_quotes.
      const quoteId = "11111111-1111-1111-1111-111111111111";
      await c.query(
        `INSERT INTO vendor_quotes (id, org_id, solicitation_id, prospect_id, token_jti)
         VALUES ($1, $2, $3, $4, 'jti-lineitem')`,
        [quoteId, orgId, solId, prospectId],
      );

      await expect(
        c.query(
          `INSERT INTO vendor_quote_line_items
             (org_id, quote_id, cost_type, contract_type, description, quantity, unit_rate)
           VALUES ($1, $2, 'LABOR', 'FFP'::contract_type, 'Engineer', 10, 100)`,
          [orgId, quoteId],
        ),
      ).resolves.toBeDefined();

      // And the trigger authoritatively synced contract_type from the TM solicitation (not the 'FFP' we
      // passed) — proving the SECURITY DEFINER read actually ran. Read back as the owner (hermes_token
      // has no SELECT on line items either).
      await c.query("RESET ROLE");
      const row = await c.query<{ contract_type: string }>(
        `SELECT contract_type FROM vendor_quote_line_items WHERE quote_id = $1`,
        [quoteId],
      );
      expect(row.rows[0]!.contract_type).toBe("TM");
    }));

  it("hermes_token CAN append an audit row (migration 0007) but CANNOT modify it", () =>
    withRollback(async (c) => {
      const orgId = await insertOrg(c);
      await setLocalRole(c, "hermes_token");
      await setOrgContext(c, orgId);

      // Append: the audit write submitQuote/optOut perform inside the token transaction. A TOKEN actor
      // must be attributable (actor_user_id or actor_email) per the audit_log_attributable CHECK.
      await expect(
        c.query(
          `INSERT INTO audit_log (org_id, actor_type, action, entity_type, actor_email)
           VALUES ($1, 'TOKEN', 'QUOTE_SUBMITTED', 'vendor_quotes', 'token-jti:abc123')`,
          [orgId],
        ),
      ).resolves.toBeDefined();

      // Modify: no UPDATE grant for the token role → permission denied (and the immutability trigger
      // would block it regardless). Either way the log is append-only for the token.
      const err = await capturePgError(() =>
        c.query(`UPDATE audit_log SET action = 'TAMPERED' WHERE org_id = $1`, [orgId]),
      );
      expect(err?.code).toBe(PG.INSUFFICIENT_PRIVILEGE);
    }));
});
