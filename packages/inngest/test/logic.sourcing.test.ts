/**
 * DB-backed Phase B sourcing suite (real Postgres, mocked SAM/USASpending fetch + Voyage embed + AI score).
 * Proves: discovery pre-vets deterministically (an EXCLUDED entity never becomes a prospect), creates
 * DISCOVERY vendor_prospects, embeds the solicitation scope, is idempotent (UEI dedupe), fails closed on a
 * connector error (no partial rows), and that rankProspectsByScope cosine-orders against the scope embedding
 * — the first live use of vendor_prospects_cap_vec_idx. ADVISORY only: nothing is sent or advanced (§2).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EMBED_DIM } from "@hermes/ai";
import { and, auditLog, eq, solicitations, vendorProspects, type Tx } from "@hermes/db";

import { rankProspectsByScope, sourceSubcontractors } from "../src/logic.js";
import { HAS_DB, withRollbackTx } from "./helpers/db.js";
import { insertOrg, insertSolicitation, insertUser } from "./helpers/fixtures.js";
import { makeDeps, type DepsOverrides } from "./helpers/mocks.js";

const d = HAS_DB ? describe : describe.skip;

/** A synthetic SAM Entity v3 record. */
function samRecord(opts: {
  uei: string;
  name?: string;
  excl?: string;
  small?: string;
}): Record<string, unknown> {
  return {
    entityRegistration: {
      ueiSAM: opts.uei,
      cageCode: "1ABC2",
      legalBusinessName: opts.name ?? `Entity ${opts.uei}`,
      registrationStatus: "Active",
      exclusionStatusFlag: opts.excl ?? "N",
    },
    assertions: {
      goodsAndServices: {
        primaryNaics: "541511",
        naicsList: [{ naicsCode: "541511", sbaSmallBusiness: opts.small ?? "Y" }],
      },
    },
    pointsOfContact: { governmentBusinessPOC: { email: `poc-${opts.uei}@example.test` } },
  };
}

const enc = (obj: unknown) => ({
  bytes: new TextEncoder().encode(JSON.stringify(obj)),
  contentType: "application/json",
});

/** A fetchDoc mock: SAM entity list on GET, empty USASpending result on POST. */
function samFetch(records: Record<string, unknown>[]): DepsOverrides["fetchDoc"] {
  return async (_url, opts) => {
    if (opts?.method === "POST") return enc({ results: [] }); // USASpending past-performance
    return enc({ entityData: records }); // SAM Entity search
  };
}

const SCOPE = "Provide tiered IT help desk and network support services.";

beforeAll(() => {
  // Non-empty so the SAM_API_KEY guard passes; the fetch is mocked, so no real SAM call is made (§4).
  process.env.SAM_API_KEY ??= "test-sam-key";
});
afterAll(() => {
  if (process.env.SAM_API_KEY === "test-sam-key") delete process.env.SAM_API_KEY;
});

async function seedSol(tx: Tx): Promise<{ orgId: string; solId: string; admin: string }> {
  const orgId = await insertOrg(tx);
  const admin = await insertUser(tx, orgId, { role: "ADMIN" });
  const solId = await insertSolicitation(tx, orgId, {
    status: "READY_FOR_SOURCING",
    sourcingApprovedBy: admin,
    naicsCode: "541511",
    scopeText: SCOPE,
  });
  return { orgId, solId, admin };
}

d("sourceSubcontractors (discover → deterministic pre-vet → score → DISCOVERY prospects)", () => {
  it("creates DISCOVERY prospects for vetted entities, drops the excluded one, embeds the scope, audits", () =>
    withRollbackTx(async (tx) => {
      const { orgId, solId, admin } = await seedSol(tx);
      const { deps } = makeDeps(
        {},
        {
          fetchDoc: samFetch([
            samRecord({ uei: "AAAA00000001", name: "Acme IT" }),
            samRecord({ uei: "BBBB00000002", name: "Debarred Co", excl: "Y" }), // HARD BLOCK
            samRecord({ uei: "CCCC00000003", name: "Cyber LLC" }),
          ]),
        },
      );

      const result = await sourceSubcontractors(tx, deps, {
        orgId,
        solicitationId: solId,
        requestedBy: admin,
      });
      expect(result.status).toBe("SOURCED");
      expect(result.created).toBe(2);
      expect(result.excluded).toBe(1);
      expect(result.evaluated).toBe(2);

      const prospects = await tx
        .select()
        .from(vendorProspects)
        .where(eq(vendorProspects.orgId, orgId));
      expect(prospects).toHaveLength(2);
      const ueis = prospects.map((p) => p.uei).sort();
      expect(ueis).toEqual(["AAAA00000001", "CCCC00000003"]);
      expect(prospects.every((p) => p.prospectSource === "DISCOVERY")).toBe(true);
      expect(prospects.every((p) => p.discoveryScore === 85)).toBe(true); // default mock ProspectScore
      // The excluded entity is NEVER persisted.
      expect(prospects.find((p) => p.uei === "BBBB00000002")).toBeUndefined();
      // Operator-only sourcing intel is attached + reflects the deterministic vet.
      const meta = prospects[0]!.discoveryMetadata;
      expect(meta?.exclusionClear).toBe(true);
      expect(meta?.sourcedForSolicitationId).toBe(solId);

      // The dormant scope embedding is now populated (so the cosine match can run).
      const [sol] = await tx
        .select({ emb: solicitations.scopeEmbedding })
        .from(solicitations)
        .where(eq(solicitations.id, solId));
      expect(sol!.emb).not.toBeNull();
      expect(sol!.emb!.length).toBe(EMBED_DIM);

      const sourced = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACTORS_SOURCED")));
      expect(sourced).toHaveLength(1);
      expect(sourced[0]!.actorType).toBe("ADMIN");
      const excludedAudit = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "SUBCONTRACTOR_EXCLUDED")));
      expect(excludedAudit).toHaveLength(1);
      expect(excludedAudit[0]!.actorType).toBe("SYSTEM");
    }));

  it("is idempotent: a re-run dedupes on UEI and creates no second row", () =>
    withRollbackTx(async (tx) => {
      const { orgId, solId, admin } = await seedSol(tx);
      const args = { orgId, solicitationId: solId, requestedBy: admin };
      const records = [samRecord({ uei: "AAAA00000001" }), samRecord({ uei: "CCCC00000003" })];

      const first = await sourceSubcontractors(
        tx,
        makeDeps({}, { fetchDoc: samFetch(records) }).deps,
        args,
      );
      expect(first.created).toBe(2);
      const second = await sourceSubcontractors(
        tx,
        makeDeps({}, { fetchDoc: samFetch(records) }).deps,
        args,
      );
      expect(second.created).toBe(0); // dedupe on the per-org UEI partial unique index

      const prospects = await tx
        .select()
        .from(vendorProspects)
        .where(eq(vendorProspects.orgId, orgId));
      expect(prospects).toHaveLength(2);
    }));

  it("fails closed: a connector error throws and writes no prospect rows", () =>
    withRollbackTx(async (tx) => {
      const { orgId, solId, admin } = await seedSol(tx);
      const { deps } = makeDeps(
        {},
        {
          fetchDoc: async () => {
            throw new Error("SAM entity API boom");
          },
        },
      );

      await expect(
        sourceSubcontractors(tx, deps, { orgId, solicitationId: solId, requestedBy: admin }),
      ).rejects.toThrow(/boom/);

      const prospects = await tx
        .select()
        .from(vendorProspects)
        .where(eq(vendorProspects.orgId, orgId));
      expect(prospects).toHaveLength(0); // never a partial row that looks vetted
    }));

  it("returns NO_NAICS (no rows) when the solicitation is unclassified — never sources a blind scope", () =>
    withRollbackTx(async (tx) => {
      const orgId = await insertOrg(tx);
      const admin = await insertUser(tx, orgId, { role: "ADMIN" });
      const solId = await insertSolicitation(tx, orgId, { naicsCode: null, scopeText: SCOPE });

      const result = await sourceSubcontractors(tx, makeDeps({}, { fetchDoc: samFetch([]) }).deps, {
        orgId,
        solicitationId: solId,
        requestedBy: admin,
      });
      expect(result.status).toBe("NO_NAICS");
      const prospects = await tx
        .select()
        .from(vendorProspects)
        .where(eq(vendorProspects.orgId, orgId));
      expect(prospects).toHaveLength(0);
    }));
});

d("rankProspectsByScope (cosine match — first live use of the capability vector index)", () => {
  it("orders DISCOVERY prospects by cosine proximity to the scope embedding", () =>
    withRollbackTx(async (tx) => {
      const { orgId, solId, admin } = await seedSol(tx);

      // Deterministic embeddings: the scope and the NEAR entity share a basis vector (distance ~0); the FAR
      // entity is orthogonal (distance ~1). deriveCapabilitiesText embeds the legal name, so we key on it.
      const near = new Array(EMBED_DIM).fill(0) as number[];
      near[0] = 1;
      const far = new Array(EMBED_DIM).fill(0) as number[];
      far[1] = 1;
      const embed: DepsOverrides["embed"] = async (text) => {
        if (text === SCOPE) return near; // scope
        return text.includes("NEAR") ? near : far;
      };

      const { deps } = makeDeps(
        {},
        {
          embed,
          fetchDoc: samFetch([
            samRecord({ uei: "NEAR00000001", name: "NEAR Match Inc" }),
            samRecord({ uei: "FARR00000002", name: "FAR Other LLC" }),
          ]),
        },
      );
      await sourceSubcontractors(tx, deps, { orgId, solicitationId: solId, requestedBy: admin });

      const ranked = await rankProspectsByScope(tx, { orgId, solicitationId: solId });
      expect(ranked).toHaveLength(2);
      expect(ranked[0]!.companyName).toBe("NEAR Match Inc"); // closest by cosine distance
      expect(ranked[0]!.distance).toBeLessThan(ranked[1]!.distance);
    }));
});
