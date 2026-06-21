// Console UI kit — VENDOR (subcontractor) surface views.
const { Badge: VBadge, Button: VButton, Field: VField } = window.BurgerGovDesignSystem_d0c3b4;
const VCON = window.CONSOLE;
const { PageHeader: VPageHeader } = window.ConsoleAuth;
const { StatGrid: VStatGrid } = window.ConsoleAdmin;

/* ---------- DASHBOARD ---------- */
function VendorHome({ go }) {
  return (
    <main>
      <VPageHeader title="Subcontractor dashboard" lede={`Welcome back, ${VCON.vendorName}. Here's what needs your attention.`} />
      <VStatGrid stats={VCON.vendorStats} />
      <section className="section">
        <div className="sectionHead">
          <h2 className="sectionTitle">Open RFQs <span className="sectionCount">({VCON.rfqs.length})</span></h2>
          <span className="crumb" onClick={() => go("rfqs")}>View all →</span>
        </div>
        <ul className="list">
          {VCON.rfqs.slice(0, 2).map((s) => (
            <li key={s.id} className="card cardSm hoverable">
              <div className="rowBetween">
                <div><span className="linkish" onClick={() => go("quote-submit")}>{s.title}</span><div className="metaMono">{s.agency} · NAICS {s.naics}</div></div>
                <span className="metaMono">due {s.deadline}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="section">
        <div className="sectionHead">
          <h2 className="sectionTitle">My quotes</h2>
          <span className="crumb" onClick={() => go("quotes")}>View all →</span>
        </div>
        <ul className="list">
          {VCON.myQuotes.map((q) => (
            <li key={q.id} className="card cardSm hoverable">
              <div className="rowBetween"><span className="linkish" onClick={() => go("quote")}>{q.title}</span><div className="row"><span className="tableNum">{q.total}</span><VBadge tone={q.status === "Submitted" ? "success" : "info"}>{q.status}</VBadge></div></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="section">
        <div className="sectionHead">
          <h2 className="sectionTitle">Compliance documents</h2>
          <span className="crumb" onClick={() => go("documents")}>Manage →</span>
        </div>
        <ul className="list">
          {VCON.documents.slice(0, 3).map((d, i) => (
            <li key={i} className="card cardSm"><div className="rowBetween"><span className="metaMono" style={{ color: "var(--studio-ink)" }}>{d.name}</span><VBadge tone={d.tone}>{d.status}</VBadge></div></li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/* ---------- OPEN RFQS ---------- */
function RfqsView({ go }) {
  return (
    <main>
      <VPageHeader title="Open RFQs" lede="Solicitations the firm is currently sourcing subcontractor quotes for." />
      <div className="tableWrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Agency</th><th>NAICS</th><th>Type</th><th>Response deadline</th><th>Action</th></tr></thead>
          <tbody>
            {VCON.rfqs.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td><td>{s.agency}</td><td className="tableNum">{s.naics}</td><td>{s.contractType}</td><td className="tableNum">{s.deadline}</td>
                <td><span className="linkish" onClick={() => go("quote-submit")}>Submit quote</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/* ---------- QUOTE SUBMISSION FORM ---------- */
function QuoteSubmitView({ go, onAct }) {
  const t = VCON.quoteTarget;
  const ROWS = [0, 1, 2];
  return (
    <main>
      <VPageHeader title="Submit a quote" lede="Enter your line items, terms, and upload your quote document. Nothing is shared with other subcontractors." back={{ label: "Open RFQs", onClick: () => go("rfqs") }} />
      <div className="card" style={{ marginBottom: "var(--space-8)" }}>
        <h2 className="sectionTitle" style={{ margin: 0 }}>{t.title}</h2>
        <div className="metaMono" style={{ margin: "var(--space-2) 0" }}>{t.agency} · Notice {t.notice} · {t.contractType} · due {t.deadline}</div>
        <p style={{ margin: 0, color: "var(--studio-ink)", lineHeight: 1.6 }}>{t.scope}</p>
      </div>

      <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>Line items</h2>
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        {ROWS.map((i) => (
          <div key={i} className="lineRow">
            <select className="lineSelect" aria-label={`Cost type ${i + 1}`} defaultValue="Labor">
              {t.costTypes.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
            </select>
            <input className="lineInput" placeholder="Description" aria-label={`Description ${i + 1}`} />
            <input className="lineInput" type="number" placeholder="Qty" defaultValue="1" aria-label={`Quantity ${i + 1}`} />
            <input className="lineInput" type="number" placeholder="Unit rate (USD)" aria-label={`Unit rate ${i + 1}`} />
          </div>
        ))}
        <p className="meta" style={{ marginBottom: 0 }}>Enter at least one line item. Leave unused rows blank.</p>
      </div>

      <div className="formGrid" style={{ marginBottom: "var(--space-6)" }}>
        <VField label="Period of performance" name="pop" placeholder="e.g. 12 months" />
        <label className="checkRow"><input type="checkbox" defaultChecked /> Pay-when-paid terms acceptable</label>
      </div>

      <div style={{ marginBottom: "var(--space-6)" }}>
        <span className="formLabel">Notes</span>
        <textarea className="lineInput" rows={4} placeholder="Anything the firm should know about your quote…" style={{ width: "100%", resize: "vertical" }} />
      </div>

      <div className="card uploadZone" onClick={() => onAct("File attached — quote_meridian.pdf (validated).")} style={{ marginBottom: "var(--space-6)" }}>
        <div className="metaMono" style={{ color: "var(--studio-primary)", fontSize: "1.4rem" }}>⬆</div>
        <strong>Quote document (PDF or DOCX, max 25 MB)</strong>
        <div className="meta">Magic-byte validated · signed-URL upload</div>
      </div>

      <VButton onClick={() => onAct("Quote submitted for review. No further action needed.")}>Submit quote</VButton>
    </main>
  );
}

/* ---------- MY QUOTES ---------- */
function MyQuotesView({ go }) {
  return (
    <main>
      <VPageHeader title="My quotes" lede="Quotes you've submitted, with their current review status." />
      <div className="tableWrap">
        <table className="table">
          <thead><tr><th>Solicitation</th><th>Agency</th><th>Total</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {VCON.myQuotes.map((q) => (
              <tr key={q.id}>
                <td>{q.title}</td><td>{q.agency}</td><td className="tableNum">{q.total}</td><td className="tableNum">{q.date}</td>
                <td><VBadge tone={q.status === "Submitted" ? "success" : "info"}>{q.status}</VBadge></td>
                <td><span className="linkish" onClick={() => go("quote")}>View →</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/* ---------- QUOTE DETAIL ---------- */
function QuoteView({ go }) {
  const q = VCON.quote;
  return (
    <main>
      <VPageHeader title={q.title} lede={`Notice ${q.notice}`} back={{ label: "My quotes", onClick: () => go("quotes") }} actions={<VBadge tone="success">{q.status}</VBadge>} />
      <div className="card" style={{ marginBottom: "var(--space-8)" }}>
        <ul className="list">
          <li className="rowBetween"><span className="meta">Total price</span><span className="tableNum" style={{ fontSize: "1.1rem" }}>{q.total}</span></li>
          <li className="rowBetween"><span className="meta">Period of performance</span><span>{q.pop}</span></li>
          <li className="rowBetween"><span className="meta">Pay-when-paid</span><span>{q.payWhenPaid ? "Yes" : "No"}</span></li>
        </ul>
      </div>
      {q.notes ? (
        <section className="section">
          <h2 className="sectionTitle" style={{ marginBottom: "var(--space-3)" }}>Notes</h2>
          <p style={{ color: "var(--studio-ink)", lineHeight: 1.6 }}>{q.notes}</p>
        </section>
      ) : null}
      <h2 className="sectionTitle" style={{ marginBottom: "var(--space-4)" }}>Line items</h2>
      <div className="tableWrap">
        <table className="table">
          <thead><tr><th>Cost type</th><th>Description</th><th>Qty</th><th>Unit rate</th><th>Extended</th></tr></thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={i}><td>{l.cost}</td><td>{l.desc}</td><td className="tableNum">{l.qty}</td><td className="tableNum">{l.rate}</td><td className="tableNum">{l.ext}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="tfoot"><td colSpan={4}>Total</td><td className="tableNum">{q.total}</td></tr></tfoot>
        </table>
      </div>
    </main>
  );
}

/* ---------- MY SUBCONTRACTS ---------- */
function ContractsView() {
  return (
    <main>
      <VPageHeader title="My subcontracts" lede="Contracts awarded to you, with execution and e-signature status." />
      {VCON.contracts.length === 0 ? <p className="empty">You have no subcontracts yet.</p> : (
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Solicitation</th><th>Type</th><th>Value</th><th>Status</th><th>E-sign</th></tr></thead>
            <tbody>
              {VCON.contracts.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td><td>{r.contractType}</td><td className="tableNum">{r.value}</td>
                  <td><VBadge tone={r.status === "Active" ? "success" : "info"}>{r.status}</VBadge></td>
                  <td><VBadge tone={r.esign === "Signed" ? "success" : "warn"}>{r.esign}</VBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

/* ---------- DOCUMENTS ---------- */
function DocumentsView({ onAct }) {
  return (
    <main>
      <VPageHeader title="Compliance documents" lede="Drop a document to begin validation. Background workers scan and verify each file." />
      <div className="card uploadZone" onClick={() => onAct("Upload started — scanning Past performance — VA.pdf…")} style={{ marginBottom: "var(--space-8)" }}>
        <div className="metaMono" style={{ color: "var(--studio-primary)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>⬆</div>
        <strong>Drop a compliance document here</strong>
        <div className="meta">PDF · magic-byte validated · signed-URL upload</div>
      </div>
      <div className="tableWrap">
        <table className="table">
          <thead><tr><th>File</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {VCON.documents.map((d, i) => (
              <tr key={i}><td className="tableNum" style={{ color: "var(--studio-ink)" }}>{d.name}</td><td>{d.type}</td><td><VBadge tone={d.tone}>{d.status}</VBadge></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

window.ConsoleVendor = { VendorHome, RfqsView, QuoteSubmitView, MyQuotesView, QuoteView, ContractsView, DocumentsView };
