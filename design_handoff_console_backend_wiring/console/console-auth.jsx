// Console UI kit — shared chrome (nav, page header, icons, theme) + auth screens.
const { Brand, Button, Field, Badge, Alert } = window.BurgerGovDesignSystem_d0c3b4;
const C = window.CONSOLE;

function SunIcon() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>); }
function MoonIcon() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>); }

function ThemeBtn({ theme, toggleTheme }) {
  return <button className="iconBtn" onClick={toggleTheme} aria-label="Toggle theme">{theme === "command" ? <SunIcon /> : <MoonIcon />}</button>;
}

function AppNav({ surface, route, go, theme, toggleTheme }) {
  const links = surface === "admin"
    ? [{ k: "admin", label: "Console" }, { k: "solicitations", label: "Solicitations" }, { k: "approvals", label: "Approvals" }, { k: "prospects", label: "Prospects" }, { k: "vendors", label: "Vendors" }, { k: "inquiries", label: "Inquiries" }]
    : [{ k: "vendor", label: "Dashboard" }, { k: "rfqs", label: "Open RFQs" }, { k: "quotes", label: "My Quotes" }, { k: "contracts", label: "Subcontracts" }, { k: "documents", label: "Documents" }];
  // sub-routes that should highlight a parent nav item
  const activeFor = { "solicitation-detail": "solicitations", "proposal": "solicitations", "approval-detail": "approvals", "quote-submit": "rfqs", "quote": "quotes" };
  const activeKey = activeFor[route] || route;
  return (
    <header className="navHeader">
      <div className="navInner">
        <span className="brandLink" onClick={() => go(surface === "admin" ? "admin" : "vendor")}><Brand /></span>
        <span className="surfaceTag">{surface === "admin" ? "Admin · HITL" : "Subcontractor"}</span>
        <nav className="nav">
          {links.map((l) => <button key={l.k} className={"navLink" + (activeKey === l.k ? " active" : "")} onClick={() => go(l.k)}>{l.label}</button>)}
        </nav>
        <span className="navSpacer" />
        <ThemeBtn theme={theme} toggleTheme={toggleTheme} />
        <span className="role">{surface === "admin" ? C.operator : C.vendorName}</span>
        <button className="signout" onClick={() => go(surface === "admin" ? "admin-login" : "vendor-login")}>Sign out</button>
      </div>
    </header>
  );
}

function PageHeader({ title, lede, actions, back }) {
  return (
    <header className="pageHeader">
      {back ? <div className="pageBack"><span className="crumb" onClick={back.onClick}>← {back.label}</span></div> : null}
      <div className="pageRow">
        <h1 className="pageTitle">{title}</h1>
        {actions ? <div className="pageActions">{actions}</div> : null}
      </div>
      {lede ? <p className="pageLede">{lede}</p> : null}
    </header>
  );
}

// Split auth screen (shared by both surfaces).
function AuthScreen({ kind, go, theme, toggleTheme }) {
  const admin = kind === "admin";
  const quote = admin
    ? "Nothing is sent or advanced without your explicit approval."
    : "Review open RFQs, prepare quotes, and submit — all from one secure workspace.";
  return (
    <main className="authScreen">
      <aside className="authAside">
        <div className="authAsideGrid" aria-hidden="true" />
        <div className="authAsideInner"><span className="brandLink" title="Back to burgergov.com" onClick={() => { window.location.href = "../marketing/index.html"; }}><Brand size="lg" /></span></div>
        <p className="authQuote">{quote}</p>
        <div className="authAsideMeta">
          <span className="surfaceTag">{admin ? "Human-in-the-loop console" : "Subcontractor portal"}</span>
        </div>
      </aside>
      <section className="authMain">
        <div className="authCard">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="authBadge">{admin ? "Admin access · TOTP required" : "Vendor access"}</span>
            <ThemeBtn theme={theme} toggleTheme={toggleTheme} />
          </div>
          <h1 className="authTitle">{admin ? "Console sign-in" : "Subcontractor sign-in"}</h1>
          <p className="authSubtitle">{admin ? "Operator credentials, then a one-time passcode." : "Access open RFQs, your quotes, and compliance documents."}</p>
          <form onSubmit={(e) => { e.preventDefault(); go(admin ? "admin-totp" : "vendor"); }}>
            <Field label="Email" name="email" type="email" defaultValue={admin ? "t.burger@burgergov.com" : "bids@meridianfederal.com"} autoComplete="username" />
            <Field label="Password" name="password" type="password" defaultValue="••••••••••" autoComplete="current-password" />
            <Button type="submit" block>{admin ? "Continue" : "Sign in"}</Button>
          </form>
          <p className="authSwitch">
            {admin
              ? <>Subcontractor? <span className="linkish" onClick={() => go("vendor-login")}>Vendor sign-in →</span></>
              : <>Firm operator? <span className="linkish" onClick={() => go("admin-login")}>Admin sign-in →</span></>}
          </p>
          {!admin ? <p className="authSwitch">First time, with an invitation link? <span className="linkish" onClick={() => go("invite-onboard")}>Set up your account →</span></p> : null}
          <p className="authSwitch"><span className="crumb" onClick={() => { window.location.href = "../marketing/index.html"; }}>← Back to burgergov.com</span></p>
        </div>
      </section>
    </main>
  );
}

function TotpScreen({ go, theme, toggleTheme }) {
  const [vals, setVals] = React.useState(["", "", "", "", "", ""]);
  const refs = React.useRef([]);
  function set(i, v) {
    if (!/^[0-9a-zA-Z]?$/.test(v)) return;
    const next = vals.slice(); next[i] = v.slice(-1); setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every((x) => x) ) setTimeout(() => go("admin"), 350);
  }
  return (
    <main className="authScreen">
      <aside className="authAside">
        <div className="authAsideGrid" aria-hidden="true" />
        <div className="authAsideInner"><span className="brandLink" title="Back to burgergov.com" onClick={() => { window.location.href = "../marketing/index.html"; }}><Brand size="lg" /></span></div>
        <p className="authQuote">Zero-trust access. Six characters stand between intent and the console.</p>
        <div className="authAsideMeta"><span className="surfaceTag">TOTP verification</span></div>
      </aside>
      <section className="authMain">
        <div className="authCard">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="authBadge">Step 2 · One-time passcode</span>
            <ThemeBtn theme={theme} toggleTheme={toggleTheme} />
          </div>
          <h1 className="authTitle">Enter your code</h1>
          <p className="authSubtitle">From your authenticator app. The form submits on the final character.</p>
          <div className="totpRow">
            {vals.map((v, i) => (
              <input key={i} ref={(el) => (refs.current[i] = el)} className="totpCell" inputMode="text" maxLength={1}
                value={v} onChange={(e) => set(i, e.target.value)} aria-label={`Digit ${i + 1}`} />
            ))}
          </div>
          <Button block onClick={() => go("admin")}>Verify</Button>
          <p className="authSwitch">First time? <span className="linkish" onClick={() => go("admin-enroll")}>Set up two-factor →</span></p>
          <p className="authSwitch"><span className="crumb" onClick={() => go("admin-login")}>← Back</span></p>
        </div>
      </section>
    </main>
  );
}

// Invited-vendor onboarding — the /invite/[token] screen (set a password, once).
function InviteOnboard({ go, theme, toggleTheme }) {
  return (
    <main className="authScreen">
      <aside className="authAside">
        <div className="authAsideGrid" aria-hidden="true" />
        <div className="authAsideInner"><span className="brandLink" title="Back to burgergov.com" onClick={() => { window.location.href = "../marketing/index.html"; }}><Brand size="lg" /></span></div>
        <p className="authQuote">You were invited directly. This secure link sets up your account — there is no public sign-up.</p>
        <div className="authAsideMeta"><span className="surfaceTag">Single-use onboarding link</span></div>
      </aside>
      <section className="authMain">
        <div className="authCard">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="authBadge">Invitation · {C.vendorName}</span>
            <ThemeBtn theme={theme} toggleTheme={toggleTheme} />
          </div>
          <h1 className="authTitle">Set up your account</h1>
          <p className="authSubtitle">Confirm your email and choose a password. After this, sign in anytime with your email and password.</p>
          <form onSubmit={(e) => { e.preventDefault(); go("vendor"); }}>
            <Field label="Email" name="email" type="email" defaultValue={C.vendorEmail} readOnly aria-readonly="true" />
            <Field label="Password (at least 12 characters)" name="password" type="password" defaultValue="" autoComplete="new-password" />
            <Field label="Confirm password" name="confirmPassword" type="password" defaultValue="" autoComplete="new-password" />
            <Button type="submit" block>Create account</Button>
          </form>
          <p className="authSwitch">Already set up? <span className="linkish" onClick={() => go("vendor-login")}>Sign in →</span></p>
          <p className="authSwitch"><span className="crumb" onClick={() => { window.location.href = "../marketing/index.html"; }}>← Back to burgergov.com</span></p>
        </div>
      </section>
    </main>
  );
}

// Decorative QR matrix (demo — not scannable). Deterministic pattern + finder squares.
function FakeQR({ seed }) {
  const N = 25;
  const cells = [];
  // simple deterministic PRNG from a string seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const inFinder = (r, c) => {
    const f = (br, bc) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return f(0, 0) || f(0, N - 7) || f(N - 7, 0);
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (inFinder(r, c)) continue;
    if (rand() > 0.55) cells.push(<rect key={r + "-" + c} x={c} y={r} width="1" height="1" />);
  }
  function Finder({ x, y }) {
    return (<g><rect x={x} y={y} width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>);
  }
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} width="180" height="180" fill="currentColor" shapeRendering="crispEdges" role="img" aria-label="Authenticator enrollment QR code (demo)">
      {cells}
      <Finder x={0} y={0} /><Finder x={N - 7} y={0} /><Finder x={0} y={N - 7} />
    </svg>
  );
}

// First-time admin TOTP enrollment — QR + manual key + confirm code.
function EnrollScreen({ go, theme, toggleTheme }) {
  const KEY = "JBSWY3DPEHPK3PXP NK4F TZ2A QRST";
  const [vals, setVals] = React.useState(["", "", "", "", "", ""]);
  const refs = React.useRef([]);
  function set(i, v) {
    if (!/^[0-9]?$/.test(v)) return;
    const next = vals.slice(); next[i] = v.slice(-1); setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every((x) => x)) setTimeout(() => go("admin"), 350);
  }
  return (
    <main className="authScreen">
      <aside className="authAside">
        <div className="authAsideGrid" aria-hidden="true" />
        <div className="authAsideInner"><span className="brandLink" title="Back to burgergov.com" onClick={() => { window.location.href = "../marketing/index.html"; }}><Brand size="lg" /></span></div>
        <p className="authQuote">Two factors, every session. The secret is yours alone — we store only its encrypted form.</p>
        <div className="authAsideMeta"><span className="surfaceTag">TOTP enrollment</span></div>
      </aside>
      <section className="authMain">
        <div className="authCard">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="authBadge">Step 1 · Set up 2FA</span>
            <ThemeBtn theme={theme} toggleTheme={toggleTheme} />
          </div>
          <h1 className="authTitle">Set up two-factor authentication</h1>
          <p className="authSubtitle">Scan this QR code with your authenticator app, then enter the current code to confirm.</p>
          <div className="qrFrame"><FakeQR seed={C.operator} /></div>
          <p className="enrollKey">Or enter this key manually:<br /><code className="code">{KEY}</code></p>
          <p className="formLabel" style={{ marginTop: "var(--space-4)" }}>Confirmation code</p>
          <div className="totpRow">
            {vals.map((v, i) => (
              <input key={i} ref={(el) => (refs.current[i] = el)} className="totpCell" inputMode="numeric" maxLength={1}
                value={v} onChange={(e) => set(i, e.target.value)} aria-label={`Digit ${i + 1}`} />
            ))}
          </div>
          <Button block onClick={() => go("admin")}>Confirm</Button>
          <p className="authSwitch">Already enrolled? <span className="linkish" onClick={() => go("admin-totp")}>Enter your code →</span></p>
          <p className="authSwitch"><span className="crumb" onClick={() => go("admin-login")}>← Back</span></p>
        </div>
      </section>
    </main>
  );
}

window.ConsoleAuth = { AppNav, PageHeader, AuthScreen, TotpScreen, InviteOnboard, EnrollScreen, ThemeBtn };
