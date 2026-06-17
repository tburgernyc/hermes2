/**
 * Minimal valid-row factories for the behavioural tests. Each inserts the fewest columns needed to
 * satisfy NOT NULL + CHECK + FK constraints and returns the new row's id. Call these as the OWNER
 * (before any SET ROLE) so RLS does not block setup; the surrounding withRollback discards them.
 *
 * Parameterised SQL only — no string-concatenated values.
 */
import type { PoolClient, QueryResult } from "pg";

let counter = 0;
/** Monotonic suffix so a single test can create several distinct orgs/users/notices. */
function uniq(): number {
  counter += 1;
  return counter;
}

function firstId(result: QueryResult<{ id: string }>): string {
  const row = result.rows[0];
  if (!row) throw new Error("INSERT … RETURNING id returned no row");
  return row.id;
}

export async function insertOrg(
  client: PoolClient,
  opts: { slug?: string; name?: string } = {},
): Promise<string> {
  const slug = opts.slug ?? `test-org-${uniq()}`;
  const name = opts.name ?? "Test Org";
  const result = await client.query<{ id: string }>(
    `INSERT INTO orgs (slug, name, directives) VALUES ($1, $2, '{}'::jsonb) RETURNING id`,
    [slug, name],
  );
  return firstId(result);
}

export async function insertUser(
  client: PoolClient,
  orgId: string,
  opts: { email?: string; role?: "ADMIN" | "VENDOR"; passwordHash?: string | null } = {},
): Promise<string> {
  const email = opts.email ?? `user-${uniq()}@example.test`;
  const role = opts.role ?? "VENDOR";
  const passwordHash = opts.passwordHash ?? (role === "ADMIN" ? "!hash" : null);
  const result = await client.query<{ id: string }>(
    `INSERT INTO users (org_id, email, role, password_hash)
     VALUES ($1, $2, $3::user_role, $4) RETURNING id`,
    [orgId, email, role, passwordHash],
  );
  return firstId(result);
}

export async function insertSolicitation(
  client: PoolClient,
  orgId: string,
  opts: {
    noticeId?: string;
    contractType?: "FFP" | "TM" | "FFP_MILESTONE" | null;
    status?: string;
    sourcingApprovedBy?: string | null;
  } = {},
): Promise<string> {
  const noticeId = opts.noticeId ?? `NOTICE-${uniq()}`;
  const contractType = opts.contractType ?? null;
  const status = opts.status ?? "PENDING_TRIAGE";
  const approvedBy = opts.sourcingApprovedBy ?? null;
  const approvedAt = approvedBy ? new Date() : null;
  const result = await client.query<{ id: string }>(
    `INSERT INTO solicitations
       (org_id, notice_id, title, contract_type, status, sourcing_approved_by, sourcing_approved_at)
     VALUES ($1, $2, $3, $4::contract_type, $5::solicitation_status, $6, $7) RETURNING id`,
    [orgId, noticeId, "Test Solicitation", contractType, status, approvedBy, approvedAt],
  );
  return firstId(result);
}

export async function insertVendor(
  client: PoolClient,
  orgId: string,
  opts: { companyName?: string } = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO vendors (org_id, company_name) VALUES ($1, $2) RETURNING id`,
    [orgId, opts.companyName ?? `Vendor ${uniq()}`],
  );
  return firstId(result);
}

export async function insertProspect(
  client: PoolClient,
  orgId: string,
  opts: { companyName?: string; contactEmail?: string } = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO vendor_prospects (org_id, company_name, contact_email) VALUES ($1, $2, $3) RETURNING id`,
    [orgId, opts.companyName ?? `Prospect ${uniq()}`, opts.contactEmail ?? null],
  );
  return firstId(result);
}

export async function insertQuote(
  client: PoolClient,
  orgId: string,
  opts: { solicitationId: string; vendorId?: string | null; prospectId?: string | null },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO vendor_quotes (org_id, solicitation_id, vendor_id, prospect_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [orgId, opts.solicitationId, opts.vendorId ?? null, opts.prospectId ?? null],
  );
  return firstId(result);
}

export async function insertProposal(
  client: PoolClient,
  orgId: string,
  opts: {
    solicitationId: string;
    contractType?: "FFP" | "TM" | "FFP_MILESTONE";
    status?: string;
    submittedBy?: string | null;
    counselReviewedBy?: string | null;
  },
): Promise<string> {
  const submittedBy = opts.submittedBy ?? null;
  const counselBy = opts.counselReviewedBy ?? null;
  const now = new Date();
  const result = await client.query<{ id: string }>(
    `INSERT INTO proposals
       (org_id, solicitation_id, contract_type, status,
        submitted_by, submitted_at, counsel_reviewed_by, counsel_reviewed_at)
     VALUES ($1, $2, $3::contract_type, $4::proposal_status, $5, $6, $7, $8) RETURNING id`,
    [
      orgId,
      opts.solicitationId,
      opts.contractType ?? "FFP",
      opts.status ?? "DRAFT",
      submittedBy,
      submittedBy ? now : null,
      counselBy,
      counselBy ? now : null,
    ],
  );
  return firstId(result);
}

/** A pending (or, via opts, already-claimed) VENDOR_INVITE row. created_by must be an existing user. */
export async function insertVendorInvite(
  client: PoolClient,
  orgId: string,
  opts: {
    vendorId: string;
    createdBy: string;
    invitedEmail?: string;
    tokenHash?: string;
    tokenJti?: string;
    expiresAt?: Date;
    acceptedAt?: Date | null;
    acceptedUserId?: string | null;
  },
): Promise<string> {
  const n = uniq();
  const result = await client.query<{ id: string }>(
    `INSERT INTO vendor_invites
       (org_id, vendor_id, invited_email, token_hash, token_jti, expires_at,
        created_by, accepted_at, accepted_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      orgId,
      opts.vendorId,
      opts.invitedEmail ?? `invitee-${n}@example.test`,
      opts.tokenHash ?? `hash-${n}`,
      opts.tokenJti ?? `jti-${n}`,
      opts.expiresAt ?? new Date(Date.now() + 86_400_000),
      opts.createdBy,
      opts.acceptedAt ?? null,
      opts.acceptedUserId ?? null,
    ],
  );
  return firstId(result);
}

/** A DRAFT outreach campaign (the pre-approval state). Tests drive it toward APPROVED/SENT. */
export async function insertOutreach(
  client: PoolClient,
  orgId: string,
  opts: { solicitationId: string; prospectId: string },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO outreach_campaigns (org_id, solicitation_id, prospect_id, subject, body)
     VALUES ($1, $2, $3, 'Subject', 'Body') RETURNING id`,
    [orgId, opts.solicitationId, opts.prospectId],
  );
  return firstId(result);
}
