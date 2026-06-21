// Marketing views — world-class home + inner pages. Theme-aware; composes DS primitives.
const { Cta, Button, PlaceholderBadge } = window.BurgerGovDesignSystem_d0c3b4;
const SITE = window.SITE;
const { CONSOLE_URL } = window.MarketingChrome;

// Count-up removed — the hero now shows factual capability facts, not metrics.
function Fact({ f }) {
  return (
    <div className="fact">
      <div className="factKey">{f.k}</div>
      <div className="factVal">{f.v}</div>
    </div>
  );
}

// Hero scene — a "code → live interface" composition: a glass code editor types
// out a real React component, which compiles into a floating rendered preview.
const HERO_CODE = [
  [["export ", "kw"], ["function ", "kw"], ["StatusCard", "fn"], ["({ item }) {", "pl"]],
  [["  const ", "kw"], ["status", "pl"], [" = ", "op"], ["useStatus", "fn"], ["(item);", "pl"]],
  [["  return ", "kw"], ["(", "pl"]],
  [["    <", "pl"], ["Card", "tag"], [" size=", "at"], ["\"sm\"", "str"], [">", "pl"]],
  [["      <", "pl"], ["Button", "tag"], [">Review →</", "pl"], ["Button", "tag"], [">", "pl"]],
  [["    </", "pl"], ["Card", "tag"], [">", "pl"]],
  [["  );", "pl"]],
  [["}", "pl"]],
];
const HERO_CODE_TOTAL = HERO_CODE.reduce((a, l) => a + l.reduce((b, t) => b + t[0].length, 0), 0);

function useTyper(total, run, speed, hold) {
  speed = speed || 36; hold = hold || 2000;
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!run) { setN(total); return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(total); return; }
    let raf, last = 0, count = 0, holdUntil = 0, holding = false;
    const tick = (t) => {
      if (!last) last = t;
      if (holding) {
        if (t >= holdUntil) { holding = false; count = 0; setN(0); last = t; }
      } else if (t - last >= speed) {
        last = t; count += 1; setN(count);
        if (count >= total) { holding = true; holdUntil = t + hold; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, run, speed, hold]);
  return n;
}

function CodeLines({ code, shown }) {
  let idx = 0, lastFilled = -1;
  const lines = code.map((line) => {
    const parts = [];
    line.forEach(([text, cls], ti) => {
      const start = idx, end = idx + text.length;
      const slice = shown >= end ? text : (shown > start ? text.slice(0, shown - start) : "");
      if (slice) parts.push(<span key={ti} className={"cv-tk cv-tk--" + cls}>{slice}</span>);
      idx = end;
    });
    return parts;
  });
  lines.forEach((p, li) => { if (p.length) lastFilled = li; });
  const caretLine = lastFilled < 0 ? 0 : lastFilled;
  return lines.map((parts, li) => (
    <div className="cv-line" key={li}>
      {parts.length ? parts : <span>{"\u00a0"}</span>}
      {li === caretLine ? <span className="cv-caret" /> : null}
    </div>
  ));
}

function Hero3D() {
  const inner = React.useRef(null);
  const shown = useTyper(HERO_CODE_TOTAL, true);
  function move(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    if (inner.current) inner.current.style.transform = `rotateX(${6 - py * 12}deg) rotateY(${-13 + px * 16}deg)`;
  }
  function leave() { if (inner.current) inner.current.style.transform = "rotateX(6deg) rotateY(-13deg)"; }
  return (
    <div className="scene" onMouseMove={move} onMouseLeave={leave} aria-hidden="true">
      <div className="sceneInner" ref={inner}>
        <div className="cv-grid" />
        <div className="cv-editor">
          <div className="cv-editor__bar">
            <span className="cv-dot cv-dot--r" /><span className="cv-dot cv-dot--y" /><span className="cv-dot cv-dot--g" />
            <span className="cv-file">StatusCard.tsx</span>
            <span className="cv-branch">main</span>
          </div>
          <pre className="cv-code"><CodeLines code={HERO_CODE} shown={shown} /></pre>
        </div>
        <div className="cv-preview">
          <span className="cv-preview__label">Live preview</span>
          <div className="cv-mini-field" />
          <div className="cv-mini-btn">Review →</div>
        </div>
        <div className="cv-chip cv-chip--a">&lt;/&gt;</div>
        <div className="cv-chip cv-chip--b">{"{ }"}</div>
        <span className="cv-flow cv-flow--1" /><span className="cv-flow cv-flow--2" />
      </div>
    </div>
  );
}

function useScrollProgress(ref) {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = -el.getBoundingClientRect().top;
      setP(total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return p;
}

// Larger-scale "code → interface" band: a wide editor types a full component while
// the real DS primitives assemble in a live-preview panel, line by line.
const BUILD_CODE = [
  [["export ", "kw"], ["function ", "kw"], ["RecordForm", "fn"], ["({ record }) {", "pl"]],
  [["  const ", "kw"], ["{ values, save } ", "pl"], ["= ", "op"], ["useRecord", "fn"], ["(record);", "pl"]],
  [["  return ", "kw"], ["(", "pl"]],
  [["    <", "pl"], ["Card", "tag"], [" size=", "at"], ["\"sm\"", "str"], [">", "pl"]],
  [["      <", "pl"], ["Badge", "tag"], [" tone=", "at"], ["\"success\"", "str"], [">Section 508 AA</", "pl"], ["Badge", "tag"], [">", "pl"]],
  [["      <", "pl"], ["Field", "tag"], [" label=", "at"], ["\"Applicant name\"", "str"], [" defaultValue=", "at"], ["\"Jordan Vega\"", "str"], [" />", "pl"]],
  [["      <", "pl"], ["Field", "tag"], [" label=", "at"], ["\"Case ID\"", "str"], [" defaultValue=", "at"], ["\"CMS-2025-0142\"", "str"], [" />", "pl"]],
  [["      <", "pl"], ["Button", "tag"], [" block onClick=", "at"], ["{save}", "pl"], [">Save record</", "pl"], ["Button", "tag"], [">", "pl"]],
  [["    </", "pl"], ["Card", "tag"], [">", "pl"]],
  [["  );", "pl"]],
  [["}", "pl"]],
];
const lineEnd = (i) => BUILD_CODE.slice(0, i + 1).reduce((a, l) => a + l.reduce((b, t) => b + t[0].length, 0), 0);
const BUILD_TOTAL = lineEnd(BUILD_CODE.length - 1);
const BUILD_STEPS = { card: lineEnd(3), badge: lineEnd(4), f1: lineEnd(5), f2: lineEnd(6), btn: lineEnd(7) };

function BuildScene() {
  const { Card, Button, Field, Badge } = window.BurgerGovDesignSystem_d0c3b4;
  const scroller = React.useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const progress = useScrollProgress(scroller);
  const base = lineEnd(0);
  const shown = reduce ? BUILD_TOTAL : Math.round(base + progress * (BUILD_TOTAL - base));
  const seen = (k) => shown >= BUILD_STEPS[k];
  const done = shown >= BUILD_TOTAL;
  return (
    <div className="buildScroller" ref={scroller}>
      <div className="buildSticky">
        <div className="container">
          <div className="buildHead">
            <span className="kicker">Engineered, not assembled</span>
            <h2 className="sectionTitle">We write the software ourselves.</h2>
            <p className="sectionLede">From the data model up, every interface is hand-built to specification on a consistent, accessible design system. Scroll to watch a record component come together, primitive by primitive.</p>
          </div>
          <div className="buildGrid">
            <div className="buildEditor">
              <div className="cv-editor__bar">
                <span className="cv-dot cv-dot--r" /><span className="cv-dot cv-dot--y" /><span className="cv-dot cv-dot--g" />
                <span className="cv-file">RecordForm.tsx</span>
                <span className="cv-branch">{done ? "compiled" : "compiling…"}</span>
              </div>
              <pre className="cv-code buildCode"><CodeLines code={BUILD_CODE} shown={shown} /></pre>
            </div>
            <div className="buildPreview">
              <span className="cv-preview__label">Live preview · RecordForm</span>
              <div className={"bs-pop bs-stage" + (seen("card") ? " in" : "")}>
                <Card size="sm">
                  <div className={"bs-pop bs-badgeRow" + (seen("badge") ? " in" : "")}><Badge tone="success">Section 508 AA</Badge></div>
                  <div className={"bs-pop" + (seen("f1") ? " in" : "")}><Field label="Applicant name" defaultValue="Jordan Vega" /></div>
                  <div className={"bs-pop" + (seen("f2") ? " in" : "")}><Field label="Case ID" defaultValue="CMS-2025-0142" /></div>
                  <div className={"bs-pop" + (seen("btn") ? " in" : "")}><Button block>Save record</Button></div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Credentials() {
  return (
    <ul className="credentials">
      {SITE.credentials.map((c) => (
        <li key={c.label} className="cred">
          <span className="credLabel">{c.label}</span>
          <span className="credValue">
            {c.value}
            {c.state === "pending" ? <PlaceholderBadge>Pending</PlaceholderBadge> : null}
            {c.state === "assigned" ? <PlaceholderBadge>On request</PlaceholderBadge> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CapabilityMatrix() {
  return (
    <div className="matrix">
      {SITE.capabilities.map((c) => (
        <article key={c.code} className="matrixCard">
          <div className="matrixHead">
            <span className="matrixCode">NAICS {c.code}</span>
            <h3 className="matrixName">{c.name}</h3>
            <p className="matrixSummary">{c.summary}</p>
          </div>
          <ul className="workList">
            {c.work.map((w) => <li key={w} className="workItem">{w}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function AdjacencyNote() {
  return (
    <aside className="adjacency">
      <span className="adjacencyTag">Beyond the core</span>
      <p className="adjacencyText">{SITE.adjacency}</p>
    </aside>
  );
}

function AISection() {
  return (
    <div className="aiGrid">
      {SITE.ai.pillars.map((p, i) => (
        <article key={p.name} className="aiCard">
          <span className="aiIndex" aria-hidden="true">AI</span>
          <h3 className="aiName">{p.name}</h3>
          <p className="aiText">{p.text}</p>
        </article>
      ))}
    </div>
  );
}

function ApproachSection() {
  return (
    <div className="approachGrid">
      {SITE.approach.map((a, i) => (
        <div key={a.name} className="stage">
          <span className="stageNum">{String(i + 1).padStart(2, "0")}</span>
          <div className="stageName">{a.name}</div>
          <p className="stageText">{a.text}</p>
        </div>
      ))}
    </div>
  );
}

function PartnerSection({ go }) {
  return (
    <div className="partnerWrap">
      <p className="sectionLede" style={{ maxWidth: "72ch" }}>{SITE.partner.intro}</p>
      <div className="pathSplit">
        {SITE.partner.paths.map((p, i) => (
          <article key={p.name} className={"pathCard" + (i === 1 ? " pathCard--primary" : "")}>
            <span className="pathTag">{p.tag}</span>
            <h3 className="pathName">{p.name}</h3>
            <p className="pathText">{p.text}</p>
            <ul className="pathList">
              {p.bullets.map((b) => <li key={b} className="pathItem">{b}</li>)}
            </ul>
            {i === 1
              ? <div className="pathFoot"><Cta href={CONSOLE_URL + "#vendor-login"}>{p.cta}</Cta></div>
              : <div className="pathFoot"><span className="pathNote">Opens automatically from your invitation link</span></div>}
          </article>
        ))}
      </div>
      <p className="muted" style={{ fontSize: "0.9rem", marginTop: "var(--space-6)" }}>
        Not yet invited? We reach out directly when a solicitation fits your capabilities — there is nothing to apply for here.
      </p>
    </div>
  );
}

// ============================================================
// Helpers + interlude scenes (Option 1 flow, Option 3 fabric)
// ============================================================
function mvCssVar(name, fb) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}
function mvHexToRgb(raw, fb) {
  let h = (raw || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return fb;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Option 1 — manual tasks (left) pulled through an AI core and emerging
// as automated outcomes (right). Continuous pulses; one lane lights at a time.
const AF_IN = [
  { name: "Manual data entry", sub: "repeat" },
  { name: "Status update emails", sub: "repeat" },
  { name: "Copy-paste between tools", sub: "repeat" },
  { name: "Routine report exports", sub: "repeat" },
];
const AF_OUT = [
  { name: "Validated records", sub: "automated" },
  { name: "Routed updates", sub: "automated" },
  { name: "Reports on demand", sub: "automated" },
  { name: "Time back for judgment", sub: "your team", hi: true },
];
// Flow palette — refined red → amber → green (stop → process → done), legible on the void.
const AF_R = [214, 72, 72], AF_Y = [224, 168, 58], AF_G = [46, 176, 110];
function afColAt(t) {
  t = Math.max(0, Math.min(1, t));
  const lp = (a, b, u) => [Math.round(a[0] + (b[0] - a[0]) * u), Math.round(a[1] + (b[1] - a[1]) * u), Math.round(a[2] + (b[2] - a[2]) * u)];
  return t < 0.5 ? lp(AF_R, AF_Y, t / 0.5) : lp(AF_Y, AF_G, (t - 0.5) / 0.5);
}
const AF_CYCLE = 3600;
// Circular neural network: nodes sampled in a disc, each an animated 0/1, with a
// code pulse sweeping left→right through the mesh and "AI" woven into the center.
// Rendered on a canvas inside the SVG via <foreignObject>.
function genBrainNet() {
  const Cx = 107, Cy = 92, Rc = 46;
  const boundary = [], NB = 28;
  for (let i = 0; i < NB; i++) { const a = (i / NB) * Math.PI * 2; boundary.push([Cx + Math.cos(a) * Rc, Cy + Math.sin(a) * Rc]); }
  const interior = [], minD = 10.5;
  for (let i = 0; i < 3000; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (Rc - 3.5);
    const x = Cx + Math.cos(a) * r, y = Cy + Math.sin(a) * r;
    let ok = true;
    for (const n of interior) { const dx = n[0] - x, dy = n[1] - y; if (dx * dx + dy * dy < minD * minD) { ok = false; break; } }
    if (ok) for (const n of boundary) { const dx = n[0] - x, dy = n[1] - y; if (dx * dx + dy * dy < (minD * 0.85) * (minD * 0.85)) { ok = false; break; } }
    if (ok) interior.push([x, y]);
  }
  const nodes = [...boundary, ...interior].map((n) => ({ x: n[0], y: n[1], ch: Math.random() < 0.5 ? "0" : "1", ph: Math.random() * 6.28, armed: true }));
  const thr = 23, edges = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
    if (dx * dx + dy * dy < thr * thr) edges.push([i, j]);
  }
  return { nodes, edges };
}
function BrainNet({ theme }) {
  const ref = React.useRef(null);
  const data = React.useMemo(genBrainNet, []);
  React.useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colAt = afColAt;
    const { nodes, edges } = data;
    const minX = 30, maxX = 184, minY = 42, maxY = 142, LW = maxX - minX, LH = maxY - minY;
    const sig = 22, period = AF_CYCLE, span = LW + sig * 3;
    let W = 0, H = 0, SS = 2.6, raf = 0, running = true;
    function resize() { W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * SS); canvas.height = Math.round(H * SS); ctx.setTransform(SS, 0, 0, SS, 0, 0); }
    function frame(ts) {
      const t = ts;
      const sX = W / LW, sY = H / LH, fs = Math.max(7, sX * 7.5);
      const waveX = minX - sig + ((t % period) / period) * span;
      const mx = (x) => (x - minX) * sX, my = (y) => (y - minY) * sY;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      for (const [i, j] of edges) {
        const a = nodes[i], b = nodes[j], midx = (a.x + b.x) / 2;
        const dd = midx - waveX, inten = Math.exp(-(dd * dd) / (2 * sig * sig));
        const col = colAt((midx - minX) / LW);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.1 + inten * 0.55})`;
        ctx.lineWidth = 0.5 + inten * 1.2;
        ctx.beginPath(); ctx.moveTo(mx(a.x), my(a.y)); ctx.lineTo(mx(b.x), my(b.y)); ctx.stroke();
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `600 ${fs}px monospace`;
      for (const n of nodes) {
        const dd = n.x - waveX, inten = Math.exp(-(dd * dd) / (2 * sig * sig));
        if (inten > 0.55 && n.armed) { n.ch = Math.random() < 0.5 ? "0" : "1"; n.armed = false; }
        if (inten < 0.2) { n.armed = true; if (Math.random() < 0.004) n.ch = Math.random() < 0.5 ? "0" : "1"; }
        const bright = Math.min(1, (0.5 + 0.18 * Math.sin(t * 0.003 + n.ph)) * 0.7 + inten);
        const col = colAt((n.x - minX) / LW);
        ctx.shadowBlur = 3 + inten * 16; ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.45 + bright * 0.55})`;
        ctx.fillText(n.ch, mx(n.x), my(n.y));
      }
      ctx.shadowBlur = 0;
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    resize();
    if (reduce) frame(period * 0.5); else raf = requestAnimationFrame(frame);
    const onResize = () => { resize(); if (reduce) frame(period * 0.5); };
    const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!reduce && !running) { running = true; raf = requestAnimationFrame(frame); } };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); };
  }, [theme, data]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden="true" />;
}

// "AI" label above the circle, colored with the same red→amber→green flow and a
// bright highlight that sweeps left→right in sync with the network pulse.
function AILabel({ theme }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, SS = 2.6, raf = 0, running = true;
    function resize() { W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * SS); canvas.height = Math.round(H * SS); ctx.setTransform(SS, 0, 0, SS, 0, 0); }
    function draw(phase) {
      ctx.clearRect(0, 0, W, H);
      const fs = Math.min(H * 0.84, W * 0.42), tw = fs * 1.2, x0 = W / 2 - tw / 2;
      ctx.font = `800 ${fs}px "Hanken Grotesk", system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const g = ctx.createLinearGradient(x0, 0, x0 + tw, 0);
      g.addColorStop(0, "rgb(214,72,72)"); g.addColorStop(0.5, "rgb(224,168,58)"); g.addColorStop(1, "rgb(46,176,110)");
      ctx.shadowBlur = fs * 0.3; ctx.shadowColor = "rgba(46,176,110,0.35)";
      ctx.fillStyle = g; ctx.fillText("AI", W / 2, H / 2);
      ctx.shadowBlur = 0;
      // moving highlight, clipped to the letters
      const hx = x0 - tw * 0.3 + tw * 1.6 * phase;
      ctx.globalCompositeOperation = "source-atop";
      const hg = ctx.createRadialGradient(hx, H / 2, 0, hx, H / 2, tw * 0.5);
      hg.addColorStop(0, "rgba(255,255,255,0.8)"); hg.addColorStop(0.5, "rgba(255,255,255,0.18)"); hg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    function frame(ts) { draw((ts % AF_CYCLE) / AF_CYCLE); if (running && !reduce) raf = requestAnimationFrame(frame); }
    resize();
    if (reduce) draw(0.5); else raf = requestAnimationFrame(frame);
    const onResize = () => { resize(); if (reduce) draw(0.5); };
    const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!reduce && !running) { running = true; raf = requestAnimationFrame(frame); } };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); };
  }, [theme]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden="true" />;
}

function AutomationFlow({ theme }) {
  const [active, setActive] = React.useState(0);
  const [outOn, setOutOn] = React.useState(false);
  const rainRef = React.useRef(null);
  // Phase-lock the lane highlight to the brain's left→right pulse via a shared
  // absolute clock, so one task visibly feeds in, sweeps through, and completes.
  React.useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setActive(0); setOutOn(true); return; }
    let raf = 0, laneRef = -1, outRef = false;
    const tick = () => {
      const now = performance.now(), p = (now % AF_CYCLE) / AF_CYCLE, l = Math.floor(now / AF_CYCLE) % 4, o = p > 0.78;
      if (l !== laneRef) { laneRef = l; setActive(l); }
      if (o !== outRef) { outRef = o; setOutOn(o); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Subtle binary rain behind the SVG (transparent canvas over the glass panel)
  React.useEffect(() => {
    const canvas = rainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let Wd = 0, Hd = 0, DPR = 1, raf = 0, running = true, drops = [], cols = 0, last = 0;
    const step = 16;
    function resize() {
      const host = canvas.parentElement;
      DPR = Math.min(2, window.devicePixelRatio || 1);
      Wd = host.clientWidth; Hd = host.clientHeight;
      canvas.width = Wd * DPR; canvas.height = Hd * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.floor(Wd / step);
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * (Hd / step)));
      ctx.clearRect(0, 0, Wd, Hd);
    }
    function draw() {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, Wd, Hd);
      ctx.restore();
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      for (let i = 0; i < cols; i++) {
        const x = i * step + 3, y = drops[i] * step;
        const c = afColAt(cols > 1 ? i / (cols - 1) : 0.5);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.3)`;
        ctx.fillText(Math.random() < 0.5 ? "0" : "1", x, y);
        if (y > Hd && Math.random() > 0.975) drops[i] = 0; else drops[i]++;
      }
    }
    function frame(t) {
      if (running) raf = requestAnimationFrame(frame);
      if (t - last < 90) return; // throttle for a calm, readable rain
      last = t;
      draw();
    }
    resize();
    if (reduce) { draw(); }
    else raf = requestAnimationFrame(frame);
    const onResize = () => { resize(); if (reduce) draw(); };
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; raf = requestAnimationFrame(frame); }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const W = 940, H = 360, cx = 470, cy = 180;
  const cardW = 224, cardH = 52, gap = 18;
  const colTop = (H - (cardH * 4 + gap * 3)) / 2;
  const ys = [0, 1, 2, 3].map((i) => colTop + i * (cardH + gap));
  const leftX = 26, rightX = W - 26 - cardW;
  const leftEdge = leftX + cardW, rightEdge = rightX;
  const inPath = (y) => {
    const sy = y + cardH / 2, ex = cx - 90, ey = cy, mx = (leftEdge + ex) / 2;
    return `M ${leftEdge} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
  };
  const outPath = (y) => {
    const sy = y + cardH / 2, sx = cx + 90, ey = cy, mx = (sx + rightEdge) / 2;
    return `M ${sx} ${ey} C ${mx} ${ey}, ${mx} ${sy}, ${rightEdge} ${sy}`;
  };
  // 0/1 glyphs streaming along each wire — binary-code automation.
  const inDigits = ["0", "1", "1"], outDigits = ["1", "0", "1"];
  return (
    <div className="afScene">
      <canvas className="af-rain" ref={rainRef} aria-hidden="true" />
      <svg className="af-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Manual tasks stream as binary through an AI core and emerge automated">
        {ys.map((y, i) => <path key={"iw" + i} className="af-wire inWire" d={inPath(y)} style={{ opacity: active === i ? 0.95 : 0.4 }} />)}
        {ys.map((y, i) => <path key={"ow" + i} className="af-wire outWire" d={outPath(y)} style={{ opacity: (active === i && outOn) ? 0.95 : 0.4 }} />)}
        {ys.map((y, i) => inDigits.map((d, k) => (
          <text key={"ib" + i + "_" + k} className="af-bit" textAnchor="middle" fill="#d64848">
            {(i + k) % 2 ? "1" : "0"}
            <animateMotion dur="2s" begin={`${i * 0.4 + k * 0.66}s`} repeatCount="indefinite" path={inPath(y)} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
            <animate attributeName="opacity" dur="2s" begin={`${i * 0.4 + k * 0.66}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.82;1" />
          </text>
        )))}
        {ys.map((y, i) => outDigits.map((d, k) => (
          <text key={"ob" + i + "_" + k} className="af-bit" textAnchor="middle" fill="#2eb06e">
            {(i + k) % 2 ? "0" : "1"}
            <animateMotion dur="2s" begin={`${0.9 + i * 0.4 + k * 0.66}s`} repeatCount="indefinite" path={outPath(y)} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
            <animate attributeName="opacity" dur="2s" begin={`${0.9 + i * 0.4 + k * 0.66}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.82;1" />
          </text>
        )))}
        {AF_IN.map((c, i) => (
          <g key={"l" + i} style={{ opacity: active === i ? 1 : 0.82, transition: "opacity .5s ease" }}>
            <rect className="af-card-bg" x={leftX} y={ys[i]} width={cardW} height={cardH} rx="12" />
            <text className="af-sub" x={leftX + 16} y={ys[i] + 19}>{c.sub}</text>
            <text className="af-label" x={leftX + 16} y={ys[i] + 38}>{c.name}</text>
          </g>
        ))}
        {AF_OUT.map((c, i) => (
          <g key={"r" + i}>
            <rect className={"af-card-bg" + (c.hi || (active === i && outOn) ? " lit" : "")} x={rightX} y={ys[i]} width={cardW} height={cardH} rx="12" />
            <text className="af-sub" x={rightX + 16} y={ys[i] + 19} style={{ fill: "var(--signal)" }}>{c.sub}</text>
            <text className="af-label" x={rightX + 16} y={ys[i] + 38}>{c.name}</text>
          </g>
        ))}
        <foreignObject x={cx - 90} y={cy - 158} width="180" height="62">
          <AILabel theme={theme} />
        </foreignObject>
        <foreignObject x={cx - 150} y={cy - 100} width="300" height="200">
          <BrainNet theme={theme} />
        </foreignObject>
      </svg>
    </div>
  );
}

// Option 3 — binary-code rain band. Transparent canvas so the page background
// shows through; re-inits on theme change.
function NeuralFabric({ theme }) {
  const wrap = React.useRef(null);
  const cvs = React.useRef(null);
  React.useEffect(() => {
    const canvas = cvs.current, container = wrap.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pRGB = mvHexToRgb(mvCssVar("--studio-primary", "#3b82f6"), [59, 130, 246]);
    const sRGB = mvHexToRgb(mvCssVar("--signal", "#34d399"), [52, 211, 153]);
    let W = 0, H = 0, DPR = 1, raf = 0, running = true, last = 0;
    let cols = 0, drops = [], speed = [];
    const step = 18, FS = 15;
    const pointer = { x: -9999, on: false };
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = container.clientWidth; H = container.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.ceil(W / step);
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * (H / FS)));
      speed = Array.from({ length: cols }, () => 0.5 + Math.random() * 0.9);
      ctx.clearRect(0, 0, W, H);
    }
    function draw() {
      // fade prior glyphs on a transparent canvas (matrix trail)
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.font = FS + "px monospace";
      ctx.textBaseline = "top";
      for (let i = 0; i < cols; i++) {
        const x = i * step + 4, y = drops[i] * FS;
        const near = pointer.on && Math.abs(x - pointer.x) < 70;
        const c = (i % 6 === 0 || near) ? sRGB : pRGB;
        // bright leading glyph
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${near ? 0.9 : 0.62})`;
        ctx.fillText(Math.random() < 0.5 ? "0" : "1", x, y);
        // soft glyph just behind the head
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.28)`;
        ctx.fillText(Math.random() < 0.5 ? "0" : "1", x, y - FS);
        if (y > H && Math.random() > 0.965) drops[i] = 0; else drops[i] += speed[i];
      }
    }
    function frame(t) {
      if (running) raf = requestAnimationFrame(frame);
      if (t - last < 70) return; // calm, readable cadence
      last = t;
      draw();
    }
    resize();
    if (reduce) { for (let i = 0; i < 40; i++) draw(); } else raf = requestAnimationFrame(frame);
    const onResize = () => { resize(); if (reduce) for (let i = 0; i < 40; i++) draw(); };
    const onMove = (e) => { const r = container.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.on = true; };
    const onLeave = () => { pointer.on = false; };
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; raf = requestAnimationFrame(frame); }
    };
    window.addEventListener("resize", onResize);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme]);
  return (
    <section className="fabricBand" ref={wrap}>
      <canvas className="nf-canvas" ref={cvs} aria-hidden="true" />
      <div className="nf-overlay">
        <div className="container" style={{ textAlign: "center" }}>
          <div className="nf-kicker">Burger Consulting LLC</div>
          <p className="nf-line">Software, systems, and interfaces — <span className="accentText">owned end to end</span>.</p>
        </div>
      </div>
    </section>
  );
}

function HomeView({ go, theme }) {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="heroLayout">
            <div className="heroCopy">
              <span className="statusPill reveal" style={{ transitionDelay: "0.05s" }}><span className="liveDot" />{SITE.hero.kicker}</span>
              <h1 className="heroTitle reveal" style={{ transitionDelay: "0.12s" }}>Software, systems,<br />and interfaces —<br />built to spec<br />and <span className="accentText">owned<br />end to end</span>.</h1>
              <p className="heroLede reveal" style={{ transitionDelay: "0.2s" }}>{SITE.hero.lede}</p>
              <div className="heroActions reveal" style={{ transitionDelay: "0.32s" }}>
                <span onClick={() => go("contact")}><Cta href="#">Request a capability statement</Cta></span>
                <Cta href={CONSOLE_URL + "#vendor-login"} variant="secondary">Subcontractor sign in →</Cta>
              </div>
            </div>
            <div className="reveal" style={{ transitionDelay: "0.22s" }}><Hero3D /></div>
          </div>
          <div className="metricStrip">
            {SITE.facts.map((f, i) => <Fact key={i} f={f} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="kicker">Capabilities</span>
          <h2 className="sectionTitle">Three core competencies, one accountable shop.</h2>
          <p className="sectionLede">Software and systems work that serves any client — government or commercial. Each competency below maps to the NAICS area it satisfies for federal contracts, but the same capability delivers just as well for private-sector teams and founders. These are our focus, not our limit.</p>
          <CapabilityMatrix />
          <AdjacencyNote />
        </div>
      </section>

      <section className="buildBand">
        <BuildScene />
      </section>

      <section className="section">
        <div className="container">
          <span className="kicker">AI-first by practice</span>
          <h2 className="sectionTitle">{SITE.ai.title}</h2>
          <p className="sectionLede">{SITE.ai.lede}</p>
          <AISection />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <span className="kicker">Automate the busywork</span>
          <h2 className="sectionTitle">Repetitive work in. Judgment out.</h2>
          <p className="sectionLede">The same automation we build for clients, shown plainly: routine tasks flow through an AI core and come back as outcomes a team can act on — freeing people for the work only judgment can do.</p>
          <AutomationFlow theme={theme} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="kicker">How we work</span>
          <h2 className="sectionTitle">Delivery you can hold someone accountable for.</h2>
          <p className="sectionLede">A small, senior shop with a hands-on ethos: clear scope, compliant by design, accessible by default, and one owner answerable for the result.</p>
          <ApproachSection />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="kicker">For invited partners</span>
          <h2 className="sectionTitle">Working with us as a subcontractor.</h2>
          <PartnerSection go={go} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="kicker">Registrations</span>
          <h2 className="sectionTitle">Where we stand today — stated plainly.</h2>
          <p className="sectionLede">We represent only what is true now. Anything pending is labeled as such; the UEI is shared with agencies and primes on request.</p>
          <Credentials />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="principal">
            <img className="avatar" src="assets/founder.png" alt={SITE.principal.name} />
            <div>
              <span className="kicker">Founder-led</span>
              <h2 className="sectionTitle" style={{ marginBottom: "var(--space-2)" }}>{SITE.principal.name}</h2>
              <p className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", letterSpacing: "0.04em", margin: "0 0 var(--space-4)" }}>{SITE.principal.title}</p>
              <p className="portalText" style={{ maxWidth: "64ch" }}>Timothy Burger personally scopes, designs, and builds every engagement. One accountable owner who writes the code, owns the data model, and answers for the outcome — the most honest trust signal a small firm can offer. You will always know exactly who is responsible for your project.</p>
              <ul className="tagList">{SITE.stack.map((s) => <li key={s} className="tag">{s}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <NeuralFabric theme={theme} />

      <section className="ctaBand">
        <div className="container">
          <div className="ctaInner">
            <h2 className="ctaTitle">Let&rsquo;s talk about your requirement.</h2>
            <p className="heroLede" style={{ margin: "0 auto var(--space-6)", maxWidth: "52ch" }}>Agencies and primes: request a capability statement or start a conversation about an upcoming effort.</p>
            <div className="ctaActions">
              <span onClick={() => go("contact")}><Cta href="#">Request a capability statement</Cta></span>
              <span onClick={() => go("capabilities")}><Cta href="#" variant="secondary">View capabilities</Cta></span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CapabilitiesView() {
  return (
    <>
      <header className="pageHeader">
        <div className="container">
          <span className="kicker">Capability statement</span>
          <h1 className="heroTitle" style={{ fontSize: "clamp(2.4rem,5vw,3.6rem)" }}>What we deliver, mapped to how we&rsquo;re registered.</h1>
          <p className="heroLede">A plain account of Burger Consulting LLC&rsquo;s federal IT disciplines, technical stack, and registrations.</p>
        </div>
      </header>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <CapabilityMatrix />
          <AdjacencyNote />
          <h2 className="sectionTitle" style={{ marginTop: "var(--space-16)" }}>Technical stack</h2>
          <ul className="tagList" style={{ marginTop: "var(--space-4)" }}>
            {SITE.stack.map((s) => <li key={s} className="tag">{s}</li>)}
          </ul>
          <h2 className="sectionTitle" style={{ marginTop: "var(--space-16)" }}>Registrations</h2>
          <Credentials />
        </div>
      </section>
    </>
  );
}

function AboutView() {
  return (
    <>
      <header className="pageHeader">
        <div className="container">
          <span className="kicker">About</span>
          <h1 className="heroTitle" style={{ fontSize: "clamp(2.4rem,5vw,3.6rem)" }}>One accountable owner, end to end.</h1>
        </div>
      </header>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="principal" style={{ marginTop: 0, marginBottom: "var(--space-16)" }}>
            <img className="avatar" src="assets/founder.png" alt={SITE.principal.name} />
            <div>
              <h2 className="sectionTitle" style={{ marginBottom: "var(--space-2)" }}>{SITE.principal.name}</h2>
              <p className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{SITE.principal.title}</p>
              <ul className="tagList">{SITE.stack.map((s) => <li key={s} className="tag">{s}</li>)}</ul>
            </div>
          </div>
          <div className="prose">
            <p>Burger Consulting LLC is a small business delivering custom software, computer systems design, and specialized IT services for federal agencies and prime contractors. The principal has delivered across regulated and commercial domains — legal, medical, and ecommerce — the source of the right instincts for federal work: compliance awareness and data sensitivity.</p>
            <h2>How we work</h2>
            <ul>
              <li>Built to spec — scope, data model, and acceptance criteria agreed up front.</li>
              <li>Compliance-minded — data sensitivity and audit-readiness designed in from day one.</li>
              <li>Accessible by default — Section 508 / WCAG 2.1 AA is a baseline, not an add-on.</li>
              <li>Personally accountable — one owner writes the code and answers for the outcome.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function ContactView({ sent, onSend }) {
  return (
    <>
      <header className="pageHeader">
        <div className="container">
          <span className="kicker">Contact</span>
          <h1 className="heroTitle" style={{ fontSize: "clamp(2.4rem,5vw,3.6rem)" }}>Let&rsquo;s talk about your requirement.</h1>
          <p className="heroLede">For agencies and prime contractors. Tell us about the effort and we&rsquo;ll follow up directly — every inquiry reaches the principal.</p>
        </div>
      </header>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="formCard">
            {sent ? (
              <div role="status">
                <h3 className="capTitle" style={{ marginTop: 0 }}>Inquiry received.</h3>
                <p className="capText">Thank you — we will follow up directly. Direct email and phone are <PlaceholderBadge>published at launch</PlaceholderBadge>.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); onSend(); }}>
                <FieldRow label="Your name" name="name" />
                <FieldRow label="Organization" name="org" />
                <FieldRow label="Email" name="email" type="email" />
                <label style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--studio-ink)" }}>How can we help?</span>
                  <textarea name="message" rows="4" className="textarea" />
                </label>
                <Button type="submit" block>Send inquiry</Button>
              </form>
            )}
          </div>
          <aside className="adjacency" style={{ marginTop: "var(--space-8)" }}>
            <span className="adjacencyTag">Invited subcontractor?</span>
            <p className="adjacencyText">If we&rsquo;ve reached out about a specific solicitation, you don&rsquo;t need this form — use the secure link from your invitation email, or <a href={CONSOLE_URL + "#vendor-login"} style={{ color: "var(--link)", fontWeight: 600 }}>sign in to the portal</a> to review the scope and submit your proposal.</p>
          </aside>
        </div>
      </section>
    </>
  );
}

function FieldRow({ label, name, type = "text" }) {
  const { Field } = window.BurgerGovDesignSystem_d0c3b4;
  return <Field label={label} name={name} type={type} />;
}

window.MarketingViews = { HomeView, CapabilitiesView, AboutView, ContactView };
