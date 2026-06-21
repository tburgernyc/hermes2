"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type JSX, type ReactNode } from "react";

import { signOutAction } from "@/lib/auth-actions";

import { Brand } from "./Brand";
import styles from "./ConsoleShell.module.css";

type Theme = "command" | "studio";
const THEME_KEY = "bg-theme";

interface ConsoleNavLink {
  href: string;
  label: string;
}

interface ConsoleShellProps {
  /** Primary nav targets, in display order. */
  navLinks: readonly ConsoleNavLink[];
  /** aria-label for the <nav>. */
  navLabel: string;
  /** Mono signal pill, e.g. "Admin · HITL". */
  surfaceTag: string;
  /** Signed-in operator identity (server-resolved; never client-set). */
  operatorName: string;
  /** Optional title attribute for the role chip (e.g. the operator's email behind a display name). */
  operatorTitle?: string;
  /** Brand link target (the surface home). */
  homeHref: string;
  /** Optional test id on the <nav>. */
  testId?: string;
  children: ReactNode;
}

/**
 * Authenticated console shell (admin). Client component because it owns the Command(dark)/Studio(light)
 * theme toggle — applied via the `data-theme` ATTRIBUTE on this subtree's root (never an inline style, so
 * it stays within the strict CSP) and persisted to localStorage under "bg-theme", defaulting to Command
 * to match the kit. Theming is SCOPED here (a later slice globalizes it). The shell is presentational:
 * the server layout gates the route and resolves `operatorName`; rendering never mutates state. The only
 * state-changing control is the Sign out POST (a Server Action), per Prime Directive §2.
 */
export function ConsoleShell({
  navLinks,
  navLabel,
  surfaceTag,
  operatorName,
  operatorTitle,
  homeHref,
  testId,
  children,
}: ConsoleShellProps): JSX.Element {
  const [theme, setTheme] = useState<Theme>("command");
  const pathname = usePathname() ?? "";

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

  const dark = theme === "command";

  return (
    <div className={styles.shell} data-theme={dark ? "command" : undefined}>
      <div className={styles.bgMesh} aria-hidden="true" />
      <div className={styles.bgGrid} aria-hidden="true" />

      <header className={styles.navHeader}>
        <div className={styles.navInner}>
          <Link href={homeHref} className={styles.brandLink} aria-label="Console home">
            <Brand />
          </Link>
          <span className={styles.surfaceTag}>{surfaceTag}</span>
          <nav className={styles.nav} aria-label={navLabel} data-testid={testId}>
            {navLinks.map((link) => {
              const active = isActiveLink(pathname, link.href, navLinks);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? `${styles.navLink} ${styles.active}` : styles.navLink}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <span className={styles.navSpacer} />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <span className={styles.role} title={operatorTitle ?? "Signed-in operator"}>
            {operatorName}
          </span>
          <form action={signOutAction} className={styles.signoutForm}>
            <button type="submit" className={styles.signout}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className={styles.content}>{children}</div>
    </div>
  );
}

/**
 * A nav link is active when the path matches its href exactly, or sits under it (`/href/...`) AND no
 * sibling link is a longer matching prefix. Longest-prefix-wins highlights the parent for sub-routes
 * (e.g. `/admin/solicitations/123/proposal` → "Solicitations") while keeping "/admin" active only on the
 * exact home — the structural equivalent of the kit's `activeFor` map.
 */
function isActiveLink(pathname: string, href: string, links: readonly ConsoleNavLink[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !links.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
}

// Sun/Moon glyphs — inline SVG (no icon library, CSP-clean). Mirrors the auth-shell toggle; the theme-
// unification slice can lift these into a shared control.
function SunIcon(): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon(): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
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
