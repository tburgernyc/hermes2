"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type JSX, type ReactNode } from "react";

import { Badge } from "@/components/ui/console";
import { Button } from "@/components/ui/Button";
import c from "@/components/ui/console.module.css";

import { approveOutreach, rejectOutreach } from "../actions";
import { ReleaseGate } from "./ReleaseGate";
import styles from "./ApprovalCohort.module.css";

export interface RecipientRow {
  /** outreach_campaigns.id — the key approveOutreach/rejectOutreach take. */
  outreachId: string;
  prospectName: string;
  /** vendor_prospects.discovery_score (1–100) or null when unscored. */
  discoveryScore: number | null;
  prospectStatus: string;
  capabilitiesText: string | null;
  /** Derived server-side: low discovery score and/or an early prospect status. */
  lowConfidence: boolean;
}

interface ApprovalCohortProps {
  recipients: readonly RecipientRow[];
  /** Left "source solicitation" pane, rendered on the server and passed through (read-only). */
  source: ReactNode;
}

/**
 * The interactive half of the approvals detail (HITL §3/§5). Rendering never mutates: the right pane lists
 * the pending sibling campaigns (one prospect each) from server props; the ONLY writes are an explicit
 * per-row Reject and the completed-hold release gate, which loops the EXISTING approveOutreach over every
 * shown campaign. The gate is disabled until every low-confidence row is locally Confirmed (the confirm is
 * UI-only — it clears a block, it does not persist). After a write we router.refresh() so the server re-reads
 * the real state (no optimistic fiction).
 */
export function ApprovalCohort({ recipients, source }: ApprovalCohortProps): JSX.Element {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unconfirmedLowConf = recipients.filter((r) => r.lowConfidence && !confirmed.has(r.outreachId));
  const gateDisabled = sent || pending || recipients.length === 0 || unconfirmedLowConf.length > 0;

  function confirmRow(outreachId: string): void {
    setConfirmed((prev) => {
      const next = new Set(prev);
      next.add(outreachId);
      return next;
    });
  }

  function onGateComplete(): void {
    setStatus(null);
    startTransition(async () => {
      try {
        for (const r of recipients) {
          const fd = new FormData();
          fd.set("outreachId", r.outreachId);
          await approveOutreach(fd);
        }
        setSent(true);
        setStatus(`Outreach sent to ${recipients.length} ${recipients.length === 1 ? "vendor" : "vendors"}.`);
        router.refresh();
      } catch {
        setStatus("Could not send the outreach. Nothing was sent for the remaining vendors — please retry.");
      }
    });
  }

  function rejectRow(outreachId: string): void {
    setStatus(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("outreachId", outreachId);
        await rejectOutreach(fd);
        setStatus("Outreach to that vendor was rejected and will not be sent.");
        router.refresh();
      } catch {
        setStatus("Could not reject that vendor — please retry.");
      }
    });
  }

  return (
    <>
      <div className={c.split}>
        <section className={c.pane} aria-label="Source solicitation">
          <span className={c.paneLabel}>Source solicitation · locked</span>
          {source}
        </section>

        <section className={c.pane} aria-label="Vendors to contact">
          <span className={c.paneLabel}>Vendors to contact · review before sending</span>
          {recipients.length === 0 ? (
            <p className={styles.empty}>No outreach is awaiting approval for this solicitation.</p>
          ) : (
            <ul className={styles.recipients}>
              {recipients.map((r) => {
                const isConfirmed = confirmed.has(r.outreachId);
                const blocking = r.lowConfidence && !isConfirmed;
                return (
                  <li key={r.outreachId} className={styles.recipient}>
                    <div className={styles.recipientTop}>
                      <strong className={styles.recipientName}>{r.prospectName}</strong>
                      <div className={styles.badges}>
                        <Badge tone={r.lowConfidence ? "warn" : "neutral"}>
                          Discovery score {r.discoveryScore ?? "—"}/100
                        </Badge>
                        <Badge tone="info">{r.prospectStatus}</Badge>
                      </div>
                    </div>

                    {r.capabilitiesText ? (
                      <p className={styles.caps}>
                        <span className={styles.capsLabel}>Self-described capabilities:</span>{" "}
                        {r.capabilitiesText}
                      </p>
                    ) : (
                      <p className={styles.caps}>No capabilities text on file.</p>
                    )}

                    {r.lowConfidence ? (
                      <div className={`${c.docLine} ${c.flag} ${styles.flagRow}`}>
                        <span>
                          {isConfirmed
                            ? "Confirmed — included in the send."
                            : "Low confidence — confirm before this vendor can be sent to."}
                        </span>
                        {isConfirmed ? null : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={pending || sent}
                            onClick={() => confirmRow(r.outreachId)}
                          >
                            Confirm
                          </Button>
                        )}
                      </div>
                    ) : null}

                    <div className={styles.rowActions}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending || sent}
                        onClick={() => rejectRow(r.outreachId)}
                      >
                        Reject
                      </Button>
                    </div>
                    {blocking ? <span className={styles.srOnly}>Blocks sending until confirmed</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {recipients.length > 0 ? (
        <div className={styles.gateCard}>
          <div className={styles.gateText}>
            <strong className={styles.gateHead}>
              Approve &amp; send outreach to these {recipients.length}{" "}
              {recipients.length === 1 ? "vendor" : "vendors"}
            </strong>
            <p className={styles.gateSub}>
              Press and hold to confirm — this sends the outreach. Nothing is sent until the hold completes.
            </p>
            {unconfirmedLowConf.length > 0 ? (
              <p className={styles.gateHelp}>
                Confirm {unconfirmedLowConf.length} low-confidence{" "}
                {unconfirmedLowConf.length === 1 ? "vendor" : "vendors"} above to enable sending.
              </p>
            ) : null}
          </div>
          <ReleaseGate
            vendorCount={recipients.length}
            disabled={gateDisabled}
            sent={sent}
            onComplete={onGateComplete}
          />
        </div>
      ) : null}

      <p className={styles.statusMsg} role="status" aria-live="polite">
        {status}
      </p>
    </>
  );
}
