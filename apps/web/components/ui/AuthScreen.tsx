"use client";

import Link from "next/link";
import { useEffect, useState, type JSX, type ReactNode } from "react";

import { Brand } from "./Brand";
import styles from "./AuthScreen.module.css";

type Theme = "command" | "studio";
const THEME_KEY = "bg-theme";

interface AuthScreenProps {
  title: string;
  subtitle?: ReactNode;
  /** Mono pill above the title (e.g. "Admin access · TOTP required"). */
  badge?: string;
  /** Large display line in the left aside. */
  quote?: string;
  /** Small tag under the aside quote. */
  asideTag?: string;
  children: ReactNode;
}

const DEFAULT_QUOTE = "Nothing is sent or advanced without your explicit approval.";
const DEFAULT_ASIDE_TAG = "Human-in-the-loop console";

/**
 * Two-pane auth/onboarding shell (ported from the BurgerGov console UI kit): a decorative left aside
 * carrying the brand + a display quote, and a right-hand glass card with a mono badge, the <h1> title
 * (the heading the e2e specs assert on), an optional subtitle, and the page's form/content.
 *
 * Client component because it owns the Command(dark)/Studio(light) theme toggle. The theme is applied
 * via the `data-theme` ATTRIBUTE on this subtree's root — never an inline `style` — so it stays within
 * the strict CSP (no `style-src 'unsafe-inline'`); the choice persists to localStorage under "bg-theme".
 * Default is Command (dark) to match the kit. Theming is scoped to the auth screens for now (the token
 * overrides live under `[data-theme="command"]` in globals.css); a later slice globalizes it.
 */
export function AuthScreen({
  title,
  subtitle,
  badge,
  quote = DEFAULT_QUOTE,
  asideTag = DEFAULT_ASIDE_TAG,
  children,
}: AuthScreenProps): JSX.Element {
  const [theme, setTheme] = useState<Theme>("command");

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "studio" || saved === "command") setTheme(saved);
  }, []);

  function toggleTheme(): void {
    setTheme((current) => {
      const next: Theme = current === "command" ? "studio" : "command";
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  return (
    <main className={styles.screen} data-theme={theme === "command" ? "command" : undefined}>
      <aside className={styles.aside}>
        <div className={styles.asideGrid} aria-hidden="true" />
        <div className={styles.asideInner}>
          <Link href="/" className={styles.brandLink} title="Back to burgergov.com">
            <Brand />
          </Link>
        </div>
        <p className={styles.quote}>{quote}</p>
        <div className={styles.asideMeta}>
          <span className={styles.surfaceTag}>{asideTag}</span>
        </div>
      </aside>

      <section className={styles.main}>
        <div className={styles.card}>
          <div className={styles.badgeRow}>
            {badge ? <span className={styles.badge}>{badge}</span> : <span />}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          {children}
        </div>
      </section>
    </main>
  );
}

/** A short helper line under the form (account-switch / back links). */
export function AuthNote({ children }: { children: ReactNode }): JSX.Element {
  return <p className={styles.note}>{children}</p>;
}

/** An emphasized in-flow navigation link, used inside <AuthNote>. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  return (
    <Link href={href} className={styles.linkish}>
      {children}
    </Link>
  );
}

/** A muted "← Back"-style crumb link. */
export function AuthCrumb({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  return (
    <Link href={href} className={styles.crumb}>
      {children}
    </Link>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }): JSX.Element {
  const dark = theme === "command";
  return (
    <button
      type="button"
      className={styles.iconBtn}
      onClick={onToggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
