/**
 * Outreach is the other outbound channel the Prime Directive (CLAUDE.md §2) governs: a campaign may
 * not reach APPROVED/SENT without a recorded human approver, a SENT campaign needs a sent timestamp,
 * and each token hash must be paired with an expiry. These CHECKs were catalog-asserted only.
 */
import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { HAS_DB, PG, capturePgError, withRollback } from "./helpers/db.js";
import {
  insertOrg,
  insertOutreach,
  insertProspect,
  insertSolicitation,
  insertUser,
} from "./helpers/fixtures.js";

const d = HAS_DB ? describe : describe.skip;

async function base(
  c: PoolClient,
): Promise<{ orgId: string; campaignId: string; userId: string }> {
  const orgId = await insertOrg(c);
  const solId = await insertSolicitation(c, orgId);
  const prospectId = await insertProspect(c, orgId);
  const campaignId = await insertOutreach(c, orgId, { solicitationId: solId, prospectId });
  const userId = await insertUser(c, orgId, { role: "ADMIN" });
  return { orgId, campaignId, userId };
}

d("outreach human-approval gate (CLAUDE.md §2)", () => {
  it("blocks APPROVED without an approver", () =>
    withRollback(async (c) => {
      const { campaignId } = await base(c);
      const err = await capturePgError(() =>
        c.query(`UPDATE outreach_campaigns SET status='APPROVED' WHERE id=$1`, [campaignId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("outreach_approval_gate");
    }));

  it("blocks SENT without a sent_at timestamp", () =>
    withRollback(async (c) => {
      const { campaignId, userId } = await base(c);
      const err = await capturePgError(() =>
        c.query(
          `UPDATE outreach_campaigns SET status='SENT', approved_by=$2, approved_at=now(), sent_at=NULL WHERE id=$1`,
          [campaignId, userId],
        ),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("outreach_sent_requires_timestamp");
    }));

  it("blocks a quote token hash with no expiry (paired CHECK)", () =>
    withRollback(async (c) => {
      const { campaignId } = await base(c);
      const err = await capturePgError(() =>
        c.query(`UPDATE outreach_campaigns SET quote_token_hash='h' WHERE id=$1`, [campaignId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("outreach_quote_token_expiry");
    }));

  it("blocks an optout token hash with no expiry (paired CHECK)", () =>
    withRollback(async (c) => {
      const { campaignId } = await base(c);
      const err = await capturePgError(() =>
        c.query(`UPDATE outreach_campaigns SET optout_token_hash='h' WHERE id=$1`, [campaignId]),
      );
      expect(err?.code).toBe(PG.CHECK_VIOLATION);
      expect(err?.constraint).toBe("outreach_optout_token_expiry");
    }));

  it("allows APPROVED once an approver + timestamp are recorded", () =>
    withRollback(async (c) => {
      const { campaignId, userId } = await base(c);
      await expect(
        c.query(
          `UPDATE outreach_campaigns SET status='APPROVED', approved_by=$2, approved_at=now() WHERE id=$1`,
          [campaignId, userId],
        ),
      ).resolves.toBeDefined();
    }));
});
