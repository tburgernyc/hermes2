// Marketing chrome — nav (brand, links, theme toggle, portal entries) + footer.
const { Cta, Button, PlaceholderBadge } = window.BurgerGovDesignSystem_d0c3b4;
const S = window.SITE;
const CONSOLE_URL = "../console/index.html";

// Ambient living-network canvas — a drifting constellation of nodes + distance-faded
// links (the "algorithmic network"), gently reactive to the pointer. Theme-aware,
// pauses when the tab is hidden, and renders a single static frame for reduced-motion.
function AmbientCanvas({ theme }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const hexToRgb = (raw, fb) => {
      let h = (raw || "").trim().replace("#", "");
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      if (!/^[0-9a-f]{6}$/i.test(h)) return fb;
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const pRGB = hexToRgb(css.getPropertyValue("--studio-primary"), [59, 130, 246]);
    const sRGB = hexToRgb(css.getPropertyValue("--signal"), [52, 211, 153]);
    let W = 0, H = 0, DPR = 1, nodes = [], raf = 0, running = true;
    const pointer = { x: -9999, y: -9999, active: false };

    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.max(34, Math.min(94, Math.round((W * H) / 13000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        c: Math.random() < 0.5 ? sRGB : pRGB,
        r: Math.random() * 1.6 + 0.8,
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -30) n.x = W + 30; else if (n.x > W + 30) n.x = -30;
        if (n.y < -30) n.y = H + 30; else if (n.y > H + 30) n.y = -30;
      }
      const maxD = 158, maxD2 = maxD * maxD;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const t = 1 - Math.sqrt(d2) / maxD;
            ctx.strokeStyle = `rgba(${a.c[0]},${a.c[1]},${a.c[2]},${t * 0.26})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        let near = 0;
        if (pointer.active) {
          const dx = a.x - pointer.x, dy = a.y - pointer.y, pr = 240, d2 = dx * dx + dy * dy;
          if (d2 < pr * pr) {
            const t = 1 - Math.sqrt(d2) / pr;
            near = t;
            a.x += dx / (d2 + 500) * 26; a.y += dy / (d2 + 500) * 26; // gentle repel
            ctx.strokeStyle = `rgba(${sRGB[0]},${sRGB[1]},${sRGB[2]},${t * 0.6})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${a.c[0]},${a.c[1]},${a.c[2]},${0.7 + near * 0.3})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r + near * 1.6, 0, 6.283185); ctx.fill();
      }
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    resize();
    if (reduce) frame(); else raf = requestAnimationFrame(frame);
    const onResize = () => { resize(); if (reduce) frame(); };
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; raf = requestAnimationFrame(frame); }
    };
    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; };
    const onOut = () => { pointer.active = false; pointer.x = -9999; pointer.y = -9999; };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerout", onOut);
    return () => {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
    };
  }, [theme]);
  return <canvas ref={ref} className="bgNet" aria-hidden="true" />;
}

function Monogram() {
  return (
    <span className="brandMark">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="6" fill="currentColor" />
        <path d="M9 7.5h6.4c2.5 0 4 1.3 4 3.3 0 1.4-.8 2.5-2.1 2.9 1.6.3 2.6 1.5 2.6 3.1 0 2.3-1.7 3.7-4.4 3.7H9V7.5zm3 2.4v3h2.7c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5H12zm0 5.2v3.3h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.7-1.9-1.7H12z" fill="#fff" />
      </svg>
    </span>
  );
}

function SunIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
}
function MoonIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
}

function Header({ route, go, theme, toggleTheme }) {
  return (
    <header className="nav">
      <div className="navInner">
        <span className="brand" onClick={() => go("home")} role="link" aria-label="BurgerGov — home">
          <img className="brandLogo" src="assets/burgergov-logo.png" alt="" aria-hidden="true" /><span className="brandName">BURGERGOV<span className="brandTld">.com</span></span>
        </span>
        <nav className="navLinks" aria-label="Primary">
          {S.nav.map((l) => (
            <button key={l.href} className={"navLink" + (route === l.href ? " active" : "")} onClick={() => go(l.href)}>{l.label}</button>
          ))}
        </nav>
        <span className="navSpacer" />
        <div className="navTools">
          <button className="neuToggle" onClick={toggleTheme} aria-label="Toggle theme" title={theme === "command" ? "Switch to light" : "Switch to dark"}>
            {theme === "command" ? <SunIcon /> : <MoonIcon />}
          </button>
          <a className="signin" href={CONSOLE_URL + "#vendor-login"}><span className="signinText">Subcontractor<br />Login</span><span className="arrow">→</span></a>
        </div>
      </div>
    </header>
  );
}

function Footer({ go }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footerInner">
        <div>
          <p className="footerName">{S.brand}</p>
          <p className="muted" style={{ fontSize: "0.92rem", lineHeight: 1.6 }}>{S.legal} — a small business delivering custom software, database systems, and accessible UX/UI for federal agencies and prime contractors.</p>
          <p className="muted" style={{ marginTop: 10, fontSize: "0.92rem" }}>Mailing address <PlaceholderBadge>published at launch</PlaceholderBadge></p>
        </div>
        <nav className="footerCol" aria-label="Company">
          <h2>Company</h2>
          <ul>
            {S.nav.map((l) => <li key={l.href}><a onClick={() => go(l.href)}>{l.label}</a></li>)}
            <li><a href={CONSOLE_URL + "#vendor-login"}>Subcontractor portal</a></li>
            <li><a href={CONSOLE_URL + "#admin-login"}>Admin console</a></li>
          </ul>
        </nav>
        <div className="footerCol">
          <h2>Registrations</h2>
          <ul>
            <li><a onClick={() => go("capabilities")}>Capability statement</a></li>
            <li><a>Privacy Policy</a></li>
            <li><a>Terms of Service</a></li>
          </ul>
          <p className="muted" style={{ marginTop: 12, fontSize: "0.86rem", fontFamily: "var(--font-mono)" }}>NAICS {S.naics.map((n) => n.code).join(" · ")}</p>
        </div>
      </div>
      <div className="footerBottom">
        <div className="footerBottomInner">
          <span>© {year} {S.legal}. All rights reserved.</span>
          <span>{S.brand} · {S.domain}</span>
        </div>
      </div>
    </footer>
  );
}

window.MarketingChrome = { Header, Footer, Monogram, AmbientCanvas, CONSOLE_URL };
