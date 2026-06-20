import Link from "next/link";
import type { JSX, ReactNode, SelectHTMLAttributes } from "react";

import { Brand } from "./Brand";
import styles from "./console.module.css";

/**
 * Shared "console" UI kit for the admin + portal operations surfaces (Phase 9) — dense, scannable widgets
 * built on the studio design tokens (the daily-driver analogue of the marketing components). Every export
 * is presentational and server-component-safe (no client hooks). Pages compose these + the PR-A primitives
 * (Button/Field/Alert) and apply the structural classes in console.module.css (e.g. kanban, table).
 */

interface NavLink {
  href: string;
  label: string;
}

export function AppNav({
  links,
  label,
  testId,
  homeHref = "/",
}: {
  links: readonly NavLink[];
  label: string;
  testId?: string;
  homeHref?: string;
}): JSX.Element {
  return (
    <header className={styles.navHeader}>
      <div className={styles.navInner}>
        <Link href={homeHref} className={styles.brandLink} aria-label="Home">
          <Brand />
        </Link>
        <nav className={styles.nav} aria-label={label} data-testid={testId}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={styles.navLink}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  lede,
  actions,
  back,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}): JSX.Element {
  return (
    <header className={styles.pageHeader}>
      {back ? <div className={styles.pageBack}>{back}</div> : null}
      <div className={styles.pageRow}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {actions ? <div className={styles.pageActions}>{actions}</div> : null}
      </div>
      {lede ? <p className={styles.pageLede}>{lede}</p> : null}
    </header>
  );
}

export function Section({
  title,
  count,
  actions,
  children,
}: {
  title?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className={styles.section}>
      {title ? (
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            {title}
            {typeof count === "number" ? (
              <span className={styles.sectionCount}> ({count})</span>
            ) : null}
          </h2>
          {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type CardTag = "div" | "article" | "li";
export function Card({
  children,
  as = "div",
  testId,
  size = "md",
  className,
}: {
  children: ReactNode;
  as?: CardTag;
  testId?: string;
  size?: "sm" | "md";
  className?: string;
}): JSX.Element {
  const Tag = as;
  const cls = [styles.card, size === "sm" ? styles.cardSm : "", className].filter(Boolean).join(" ");
  return (
    <Tag className={cls} data-testid={testId}>
      {children}
    </Tag>
  );
}

type Tone = "neutral" | "info" | "success" | "warn" | "danger";
const TONE: Record<Tone, string | undefined> = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  success: styles.toneSuccess,
  warn: styles.toneWarn,
  danger: styles.toneDanger,
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }): JSX.Element {
  return <span className={`${styles.badge} ${TONE[tone]}`}>{children}</span>;
}

export function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "neutral" | "warn";
}): JSX.Element {
  return (
    <div className={`${styles.stat} ${tone === "warn" ? styles.statWarn : ""}`}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  children: ReactNode;
}
export function Select({ label, children, className, ...rest }: SelectProps): JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select className={[styles.select, className].filter(Boolean).join(" ")} {...rest}>
        {children}
      </select>
    </label>
  );
}
