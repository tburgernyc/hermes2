// Console UI kit — ADMIN surface views (the full operator pipeline).
const { Badge, Button, Field } = window.BurgerGovDesignSystem_d0c3b4;
const CON = window.CONSOLE;
const { PageHeader } = window.ConsoleAuth;

// Advisory ai_recommendation enum → Badge tone / label. DISPLAY ONLY — the recommendation never
// gates anything; the human decides. PURSUE → success, HUMAN_REVIEW → warn, REJECT → neutral.
// Mirrors apps/web/lib/admin-board.ts (recommendationTone / recommendationLabel).
function recTone(r) {
  if (r === "PURSUE") return "success";
  if (r === "HUMAN_REVIEW") return "warn";
  return "neutral";
}
function recLabel(r) {
  if (!r) return "—";
  const s = r.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatGrid({ stats }) {
  return (
    <div className="statGrid">
      {stats.map((s, i) => (
        <div key={i} className={"stat" + (s.tone === "warn" ? " warn" : "")}>
          <div className="statValue">{s.value}</div>
          <div className="statLabel">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- MORNING BRIEF ---------- */
function AdminHome({ go }) {
  return (
    <main>
      <PageHeader
        title="Morning brief"
        lede="Everything awaiting a human decision, as of 06:00 EDT. Rendering this page never advances any state."
      />

      {CON.brief.injection && CON.brief.injection.length ? (
        <div className="card blockerCard" style={{ marginBottom: "var(--space-6)" }}>
          <strong>
            ⚠ {CON.brief.injection.length} live solicitation(s) had quote(s) that attempted to
            influence the AI ranking — flagged and ignored. Review before relying on the rankings.
          </strong>
          <ul className="bulletList">
            {CON.brief.injection.map((s) => (
              <li key={s.id}>
                <span className="linkish" onClick={() => go("solicitation-detail")}>
                  {s.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <StatGrid stats={CON.brief.stats} />

      <section className="section">
        <div className="sectionHead">
          <h2 className="sectionTitle">
            Awaiting a sourcing decision{" "}
            <span className="sectionCount">({CON.triaged.length})</span>
          </h2>
          <span className="crumb" onClick={() => go("solicitations")}>
            Open board →
          </span>
        </div>
        <ul className="list">
          {CON.triaged.map((s) => (
            <li key={s.id} className="card cardSm hoverable">
              <div className="rowBetween">
                <div>
                  <div className="row">
                    <span className="linkish" onClick={() => go("solicitation-detail")}>
                      {s.title}
                    </span>
                    {s.recommendation ? (
                      <Badge tone={recTone(s.recommendation)}>{recLabel(s.recommendation)}</Badge>
                    ) : null}
                  </div>
                  <div className="metaMono">
                    {s.agency} · fit {s.fit}
                  </div>
                </div>
                <div className="row">
                  <div className="scoreBar" title={"feasibility " + s.feasibility}>
                    <div className="scoreFill" style={{ width: s.feasibility + "%" }} />
                  </div>
                  <span className="metaMono">{s.feasibility}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="sectionHead">
          <h2 className="sectionTitle">New contact inquiries</h2>
          <span className="crumb" onClick={() => go("inquiries")}>
            Open inbox →
          </span>
        </div>
        <ul className="list">
          {CON.inquiries
            .filter((i) => i.status === "NEW")
            .map((i) => (
              <li key={i.id} className="card cardSm hoverable">
                <div className="rowBetween">
                  <div>
                    <span className="linkish" onClick={() => go("inquiries")}>
                      {i.company}
                    </span>
                    <div className="metaMono">
                      {i.name} · {i.intent}
                    </div>
                  </div>
                  <Badge tone="warn">new</Badge>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Response deadlines within 72h{" "}
          <span className="sectionCount">({CON.deadlines.length})</span>
        </h2>
        <ul className="list">
          {CON.deadlines.map((s) => (
            <li key={s.id} className="card cardSm">
              <div className="rowBetween">
                <span>{s.title}</span>
                <Badge tone="warn">due {s.due}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/* ---------- SOLICITATIONS KANBAN ---------- */
function SolicitationsBoard({ go, onAct }) {
  return (
    <main>
      <PageHeader
        title="Solicitations"
        lede="Sourced from SAM.gov and triaged by the AI — a recommendation only. You decide what advances; rendering the board sends nothing."
      />
      <div className="kanban">
        {CON.board.map((col) => (
          <section key={col.title} className="column">
            <h2 className="columnHead">
              {col.title} <span className="columnCount">({col.items.length})</span>
            </h2>
            <div className="columnCards">
              {col.items.length === 0 ? (
                <p className="empty">—</p>
              ) : (
                col.items.map((s) => (
                  <article key={s.id} className="card cardSm hoverable">
                    <span className="linkish" onClick={() => go("solicitation-detail")}>
                      {s.title}
                    </span>
                    <div className="metaMono">{s.agency}</div>
                    <div className="row" style={{ marginTop: "var(--space-2)" }}>
                      <Badge>{s.status}</Badge>
                      {s.recommendation ? (
                        <Badge tone={recTone(s.recommendation)}>{recLabel(s.recommendation)}</Badge>
                      ) : null}
                      <span className="metaMono">
                        feas {s.feasibility} · fit {s.fit}
                      </span>
                    </div>
                    {s.gate ? (
                      <div className="row" style={{ marginTop: "var(--space-3)" }}>
                        <Button
                          size="sm"
                          onClick={() =>
                            onAct("Sourcing approved — outreach drafting queued for your review.")
                          }
                        >
                          Approve sourcing
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAct("Marked no-go — solicitation archived.")}
                        >
                          No-go
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

/* ---------- SOLICITATION DETAIL (ranked quotes) ---------- */
function SolicitationDetail({ go, onAct }) {
  const d = CON.solicitationDetail;
  return (
    <main>
      <PageHeader
        title={d.title}
        lede={`${d.agency} · ${d.status} · due ${d.deadline}`}
        back={{ label: "Solicitations", onClick: () => go("solicitations") }}
        actions={
          <div className="row">
            {d.recommendation ? (
              <Badge tone={recTone(d.recommendation)}>{recLabel(d.recommendation)}</Badge>
            ) : null}
            <Badge tone="info">feasibility {d.feasibility}</Badge>
            <Badge>{d.contractType}</Badge>
          </div>
        }
      />

      {d.injectionAttempts && d.injectionAttempts.length ? (
        <div className="card blockerCard" style={{ marginBottom: "var(--space-6)" }}>
          <strong>
            ⚠ {d.injectionAttempts.length} quote(s) attempted to influence the AI ranking and were
            ignored.
          </strong>
          <ul className="bulletList">
            {d.injectionAttempts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Triage recommendation
        </h2>
        <div className="card">
          <div className="row" style={{ marginBottom: "var(--space-3)" }}>
            {d.recommendation ? (
              <Badge tone={recTone(d.recommendation)}>{recLabel(d.recommendation)}</Badge>
            ) : null}
            <span className="metaMono">
              Notice {d.notice} · NAICS {d.naics} · fit {d.fit}
            </span>
          </div>
          {d.summary ? (
            <p className="rationale" style={{ margin: 0 }}>
              {d.summary}
            </p>
          ) : null}
          {d.concerns.length ? (
            <div style={{ marginTop: "var(--space-4)" }}>
              <strong>Flagged concerns</strong>
              <ul className="bulletList">
                {d.concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {d.scope ? (
        <section className="section">
          <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
            Scope (from SAM.gov)
          </h2>
          <div className="card">
            <p style={{ margin: 0, color: "var(--studio-ink)", lineHeight: 1.6 }}>{d.scope}</p>
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Subcontractor quotes — AI-ranked <span className="sectionCount">({d.quotes.length})</span>
        </h2>
        <ul className="list">
          {d.quotes.map((q) => (
            <li key={q.id} className="card">
              <div className="rowBetween">
                <div>
                  <div className="row">
                    <span className="rankPill">#{q.rank}</span>
                    <strong>{q.vendor}</strong>
                    {q.score != null ? (
                      <Badge tone="info">AI score {Math.round(q.score)}</Badge>
                    ) : null}
                  </div>
                  <div className="metaMono">
                    {q.status} · {q.total}
                  </div>
                </div>
                <div className="row">
                  <Button size="sm" onClick={() => onAct(`${q.vendor} shortlisted.`)}>
                    Shortlist
                  </Button>
                  {q.rank === 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onAct(
                          `${q.vendor} selected as winner — priced bid draft will be generated for your review.`,
                        )
                      }
                    >
                      Select winner
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="rationale">{q.rationale}</div>
              {q.risks && q.risks.length ? (
                <div className="rationale">
                  <strong>Risks flagged</strong>
                  <ul className="bulletList">
                    {q.risks.map((risk, i) => (
                      <li key={i}>{risk}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="meta">
          Selecting a winner records your choice; the priced bid draft is generated for review in
          the next step — nothing is submitted to the government automatically.
        </p>
        <div style={{ marginTop: "var(--space-4)" }}>
          <span className="crumb" onClick={() => go("proposal")}>
            → Review the priced bid decision-brief
          </span>
        </div>
      </section>
    </main>
  );
}

/* ---------- PROPOSAL DECISION-BRIEF ---------- */
function ChecklistRows({ items }) {
  return (
    <ul className="list">
      {items.map((ci, i) => (
        <li key={i} className="row" style={{ gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
          <Badge tone={ci.passed ? "success" : "warn"}>{ci.passed ? "PASS" : "REVIEW"}</Badge>
          <span>
            {ci.item}
            {ci.note ? ` — ${ci.note}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProposalBrief({ go, onAct }) {
  const p = CON.proposal;
  return (
    <main>
      <PageHeader
        title="Bid decision-brief"
        lede={`${p.title} · status ${p.status} · ${p.contractType}${p.provisional ? " · PROVISIONAL (dry-run baseline)" : ""}`}
        back={{ label: "Solicitation", onClick: () => go("solicitation-detail") }}
      />
      {p.watermark ? (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Badge tone="warn">{p.watermark}</Badge>
        </div>
      ) : null}

      {p.narrative ? (
        <section className="section">
          <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
            Proposal narrative
          </h2>
          <div className="card">
            <p className="meta" style={{ marginTop: 0 }}>
              AI-drafted prose for human + counsel review. Display only — it informs no pricing,
              compliance, or live-submission gate.
            </p>
            {p.narrative.executiveSummary ? (
              <>
                <strong>Executive summary</strong>
                <p className="rationale">{p.narrative.executiveSummary}</p>
              </>
            ) : null}
            {p.narrative.technicalApproach ? (
              <>
                <strong>Technical approach</strong>
                <p className="rationale">{p.narrative.technicalApproach}</p>
              </>
            ) : null}
            {p.narrative.managementApproach ? (
              <>
                <strong>Management approach</strong>
                <p className="rationale">{p.narrative.managementApproach}</p>
              </>
            ) : null}
            {p.narrative.pastPerformanceNarrative ? (
              <>
                <strong>Past performance</strong>
                <p className="rationale">{p.narrative.pastPerformanceNarrative}</p>
              </>
            ) : null}
            {p.narrative.assumptions && p.narrative.assumptions.length ? (
              <>
                <strong>Assumptions</strong>
                <ul className="bulletList">
                  {p.narrative.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Pricing scenarios <span className="sectionCount">({p.scenarios.length})</span>
        </h2>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Price</th>
                <th>Fee %</th>
                <th>Margin %</th>
                <th>vs. benchmark median</th>
              </tr>
            </thead>
            <tbody>
              {p.scenarios.map((s, i) => (
                <tr key={i}>
                  <td>{s.label}</td>
                  <td className="tableNum">{s.price}</td>
                  <td className="tableNum">{s.feePct}</td>
                  <td className="tableNum">{s.marginPct}</td>
                  <td className="tableNum">{s.vsBench}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="meta">
          Scenarios are a decision aid — you choose the number; the system never picks one.
        </p>
      </section>

      <div className="split">
        <div>
          <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
            Compliance checklist
          </h2>
          <div className="card">
            <ChecklistRows items={p.compliance} />
          </div>
        </div>
        <div>
          <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
            Bid checklist
          </h2>
          <div className="card">
            <ChecklistRows items={p.bidChecklist} />
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Live-submission blockers
        </h2>
        <div className="card blockerCard">
          <p style={{ marginTop: 0 }}>
            This bid <strong>cannot</strong> be submitted yet. The following must be resolved before
            any real bid leaves the building:
          </p>
          <ul className="bulletList">
            {p.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Review workflow
        </h2>
        <div className="card">
          <div className="rowBetween">
            <div>
              <strong>Draft → Counsel review → Ready to submit → Submit</strong>
              <div className="meta">
                Each transition is a separate human action. Submission stays blocked while any live
                gate fails.
              </div>
            </div>
            <div className="row">
              <Button size="sm" variant="ghost" onClick={() => onAct("Counsel review recorded.")}>
                Record counsel review
              </Button>
              <Button size="sm" variant="ghost" disabled title="Blocked by live-submission gates">
                Mark ready
              </Button>
              <Button size="sm" disabled title="Blocked by live-submission gates">
                Submit to agency
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------- APPROVALS ---------- */
function ApprovalsView({ go, onAct }) {
  return (
    <main>
      <PageHeader
        title="Approvals"
        lede="Each button is the only emitter of a human-gate event. Nothing is sent or advanced without your explicit approval."
        back={{ label: "Console", onClick: () => go("admin") }}
      />

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Solicitations awaiting a sourcing decision{" "}
          <span className="sectionCount">({CON.triaged.length})</span>
        </h2>
        <ul className="list">
          {CON.triaged.map((s) => (
            <li key={s.id} className="card cardSm hoverable">
              <div className="rowBetween">
                <div>
                  <div className="row">
                    <span className="linkish" onClick={() => go("approval-detail")}>
                      {s.title}
                    </span>
                    {s.recommendation ? (
                      <Badge tone={recTone(s.recommendation)}>{recLabel(s.recommendation)}</Badge>
                    ) : null}
                  </div>
                  <div className="metaMono">
                    {s.agency} · feasibility {s.feasibility} · fit {s.fit}
                  </div>
                </div>
                <div className="row">
                  <Button size="sm" variant="ghost" onClick={() => go("approval-detail")}>
                    Open split-view
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onAct("Sourcing approved — outreach drafting queued.")}
                  >
                    Approve sourcing
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Outreach awaiting approval <span className="sectionCount">({CON.outreach.length})</span>
        </h2>
        <ul className="list">
          {CON.outreach.map((o) => (
            <li key={o.id} className="card cardSm">
              <div className="rowBetween">
                <div>
                  <div className="row">
                    <strong>{o.subject}</strong>
                    {o.recommendation ? (
                      <Badge tone={recTone(o.recommendation)}>{recLabel(o.recommendation)}</Badge>
                    ) : null}
                  </div>
                  <div className="metaMono">to {o.prospect}</div>
                  {o.matchScore != null || o.capabilityMatch != null ? (
                    <div className="metaMono">
                      AI match {o.matchScore != null ? o.matchScore : "—"}/100
                      {o.capabilityMatch != null
                        ? ` · capability ${Math.round(o.capabilityMatch * 100)}%`
                        : ""}
                    </div>
                  ) : null}
                </div>
                <div className="row">
                  <Button size="sm" onClick={() => onAct("Outreach approved & sent.")}>
                    Approve &amp; send
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onAct("Outreach rejected.")}>
                    Reject
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// Long-press release gate — hold 1.5s to dispatch; release early resets.
function ReleaseGate({ onComplete }) {
  const [pct, setPct] = React.useState(0);
  const raf = React.useRef(null);
  const start = React.useRef(0);
  const done = React.useRef(false);
  const DUR = 1500;
  function begin() {
    done.current = false;
    start.current = performance.now();
    const step = (t) => {
      const p = Math.min(100, ((t - start.current) / DUR) * 100);
      setPct(p);
      if (p >= 100) {
        done.current = true;
        onComplete();
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }
  function end() {
    cancelAnimationFrame(raf.current);
    if (!done.current) setPct(0);
  }
  return (
    <button
      className="gateBtn"
      onMouseDown={begin}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={begin}
      onTouchEnd={end}
    >
      <span className="gateFill" style={{ width: pct + "%" }} />
      <span className="gateLabel">{pct >= 100 ? "Dispatched ✓" : "Hold to release bid"}</span>
    </button>
  );
}

function ApprovalDetail({ go, onAct }) {
  const d = CON.approvalDetail;
  return (
    <main>
      <PageHeader
        title={d.title}
        lede={`${d.agency} · Notice ${d.notice}`}
        back={{ label: "Approvals", onClick: () => go("approvals") }}
        actions={
          <div className="row">
            {d.recommendation ? (
              <Badge tone={recTone(d.recommendation)}>{recLabel(d.recommendation)}</Badge>
            ) : null}
            <Badge tone="info">feasibility {d.feasibility}</Badge>
          </div>
        }
      />
      <div className="split" style={{ marginBottom: "var(--space-8)" }}>
        <div className="pane">
          <span className="paneLabel">Source solicitation · locked</span>
          {d.sourceLines.map((l, i) => (
            <div key={i} className="docLine">
              {l}
            </div>
          ))}
        </div>
        <div className="pane">
          <span className="paneLabel">Vendors to contact · review before sending</span>
          <ul className="list">
            {d.recipients.map((r) => (
              <li key={r.id} className="card cardSm">
                <div className="rowBetween">
                  <strong>{r.prospect}</strong>
                  <div className="row">
                    {r.recommendation ? (
                      <Badge tone={recTone(r.recommendation)}>{recLabel(r.recommendation)}</Badge>
                    ) : null}
                    <Badge tone={r.lowConfidence ? "warn" : "neutral"}>
                      match {r.matchScore != null ? r.matchScore : "—"}/100
                    </Badge>
                  </div>
                </div>
                {r.matchScore != null || r.capabilityMatch != null ? (
                  <div className="metaMono">
                    AI match for this solicitation: {r.matchScore != null ? r.matchScore : "—"}/100
                    {r.capabilityMatch != null
                      ? ` · capability ${Math.round(r.capabilityMatch * 100)}%`
                      : ""}
                  </div>
                ) : null}
                {r.strengths && r.strengths.length ? (
                  <div className="metaMono">
                    <strong>Strengths:</strong> {r.strengths.join("; ")}
                  </div>
                ) : null}
                {r.gaps && r.gaps.length ? (
                  <div className="metaMono">
                    <strong>Gaps:</strong> {r.gaps.join("; ")}
                  </div>
                ) : null}
                {r.lowConfidence ? (
                  <div className="docLine flag" style={{ marginTop: "var(--space-2)" }}>
                    Low confidence — confirm before this vendor can be sent to.
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card">
        <div className="rowBetween">
          <div>
            <strong>Dispatch the assembled bid to the client</strong>
            <div className="meta">
              Press and hold to confirm — this prevents accidental release.
            </div>
          </div>
          <ReleaseGate
            onComplete={() => onAct("Bid dispatched — row locked. Payload sent to client.")}
          />
        </div>
      </div>
    </main>
  );
}

/* ---------- INQUIRIES INBOX ---------- */
function InquiriesView({ onAct }) {
  const newCount = CON.inquiries.filter((i) => i.status === "NEW").length;
  return (
    <main>
      <PageHeader
        title="Contact inquiries"
        lede={`${CON.inquiries.length} total · ${newCount} new. Submitted from the public site; visitor text is shown as data, never executed.`}
      />
      <ul className="list">
        {CON.inquiries.map((i) => (
          <li key={i.id} className="card">
            <div className="rowBetween">
              <div>
                <strong>{i.name}</strong> · {i.email}
                <div className="metaMono">{i.company}</div>
              </div>
              <div className="row">
                <Badge tone="info">{i.intent}</Badge>
                <Badge tone={i.status === "NEW" ? "warn" : "neutral"}>{i.status}</Badge>
                <span className="metaMono">{i.date}</span>
              </div>
            </div>
            <blockquote className="inquiryQuote">{i.message}</blockquote>
            {i.status === "NEW" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAct("Inquiry marked reviewed.")}
              >
                Mark reviewed
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

/* ---------- PROSPECTS ---------- */
function ProspectsView({ onAct }) {
  return (
    <main>
      <PageHeader
        title="Prospects"
        lede="Subcontractor candidates from AI discovery and inbound inquiries. Qualifying a prospect makes it promotable to a vetted vendor."
      />
      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Add a prospect
        </h2>
        <div className="card">
          <div className="formGrid">
            <Field label="Company" name="companyName" placeholder="Acme Federal LLC" />
            <Field label="Email" name="contactEmail" type="email" placeholder="bids@acme.com" />
            <Field label="NAICS" name="naics" placeholder="541511, 541512" />
            <Field
              label="Capabilities"
              name="capabilities"
              placeholder="Accessible UI, PostgreSQL…"
            />
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button onClick={() => onAct("Prospect added.")}>Add prospect</Button>
          </div>
        </div>
      </section>
      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          All prospects <span className="sectionCount">({CON.prospects.length})</span>
        </h2>
        <ul className="list">
          {CON.prospects.map((p) => (
            <li key={p.id} className="card cardSm">
              <div className="rowBetween">
                <div>
                  <strong>{p.company}</strong> · <span className="metaMono">{p.email}</span>
                  <div className="row" style={{ marginTop: "var(--space-2)" }}>
                    <Badge tone={p.status === "Qualified" ? "success" : "neutral"}>
                      {p.status}
                    </Badge>
                    <Badge tone="neutral">{p.source}</Badge>
                    <span className="metaMono">
                      NAICS {p.naics} · score {p.score}
                    </span>
                  </div>
                </div>
                {p.status !== "Qualified" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onAct(`${p.company} marked qualified.`)}
                  >
                    Mark qualified
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/* ---------- VENDORS (promote / vet / link / invite) ---------- */
function VendorsView({ onAct }) {
  const v = CON.vendors;
  const [copied, setCopied] = React.useState(false);
  function copy() {
    setCopied(true);
    onAct("Single-use onboarding link generated — copy it and send it to the vendor yourself.");
    if (navigator.clipboard) navigator.clipboard.writeText(v.inviteLink).catch(() => {});
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <main>
      <PageHeader
        title="Vendors"
        lede="Promote qualified prospects, vet vendors, link vendor users, and generate single-use onboarding invitations. The app never emails on its own — you send the link."
      />

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Qualified prospects <span className="sectionCount">({v.qualifiedProspects.length})</span>
        </h2>
        <ul className="list">
          {v.qualifiedProspects.map((p) => (
            <li key={p.id} className="card cardSm">
              <div className="rowBetween">
                <strong>{p.company}</strong>
                <Button
                  size="sm"
                  onClick={() => onAct(`${p.company} promoted to vendor (pending vetting).`)}
                >
                  Promote to vendor
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Vendors awaiting vetting <span className="sectionCount">({v.pendingVendors.length})</span>
        </h2>
        <ul className="list">
          {v.pendingVendors.map((x) => (
            <li key={x.id} className="card cardSm">
              <div className="rowBetween">
                <strong>{x.company}</strong>
                <Button size="sm" onClick={() => onAct(`${x.company} marked vetted.`)}>
                  Mark vetted
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Link a vendor user
        </h2>
        <div className="card">
          <p className="meta" style={{ marginTop: 0 }}>
            Binding a VENDOR-role user to a vetted vendor is admin-only — never self-asserted.
          </p>
          <div className="formGrid">
            <Field label="User" name="userId" placeholder="ops@cobaltcivic.com" />
            <Field label="Vendor" name="vendorId" placeholder="Cobalt Civic Tech" />
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button onClick={() => onAct("Vendor user linked.")}>Link</Button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>
          Invite a vendor user
        </h2>
        <div className="card">
          <p className="meta" style={{ marginTop: 0 }}>
            Generates a single-use onboarding link tied to one vetted vendor. Copy it and send it to
            the vendor yourself.
          </p>
          <div className="formGrid">
            <Field label="Vendor" name="inviteVendor" placeholder="Meridian Federal LLC" />
            <Field
              label="Invitee email"
              name="inviteEmail"
              type="email"
              placeholder="bids@meridianfederal.com"
            />
          </div>
          <div style={{ marginTop: "var(--space-4)" }} className="row">
            <Button onClick={copy}>{copied ? "Copied ✓" : "Generate & copy link"}</Button>
          </div>
          {copied ? <div className="inviteLink">{v.inviteLink}</div> : null}
        </div>
      </section>
    </main>
  );
}

window.ConsoleAdmin = {
  AdminHome,
  SolicitationsBoard,
  SolicitationDetail,
  ProposalBrief,
  ApprovalsView,
  ApprovalDetail,
  InquiriesView,
  ProspectsView,
  VendorsView,
  StatGrid,
};
