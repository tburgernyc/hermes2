/**
 * Public brand identity — the SINGLE source of truth for every marketing page, the document metadata,
 * and the footer. Plain TS (no JSX) so unit tests can import it under the node Vitest environment.
 *
 * TRUTHFULNESS CONTRACT (CLAUDE.md): every value here must be literally true today. Nothing implies
 * past performance the firm does not have, or a certification it does not hold. Anything not yet real
 * is modelled as an explicit placeholder STATE (see Credential) and rendered with a visible badge —
 * never as a finished claim, and never a plausible-looking fake identifier (esp. the CAGE code).
 */

/** Public brand name and the legal entity behind it. */
export const BRAND_NAME = "BurgerGov" as const;
export const LEGAL_NAME = "Burger Consulting LLC" as const;
export const DOMAIN = "burgergov.com" as const;

/** Document <title> / meta description (replaces the internal "Hermes 2.0" working name). */
export const SITE_TITLE = `${BRAND_NAME} — federal IT contracting by ${LEGAL_NAME}`;
export const SITE_DESCRIPTION =
  "Founder-led custom software, database systems, and accessible UX/UI for federal agencies and " +
  "prime contractors. Built to spec, compliance-minded, and personally accountable.";

/** One short, true value proposition for the hero. */
export const TAGLINE =
  "Custom software, database systems, and accessible interfaces — built to spec for government." as const;

/** The accountable owner. Founder-led is the firm's strongest, most honest trust signal. */
export const PRINCIPAL = {
  name: "Timothy Burger",
  title: "CEO & Lead Software Designer",
} as const;

/** Languages/stack the principal builds in (true today). Surfaced on About to evidence depth. */
export const PRINCIPAL_STACK = [
  "Python",
  "JavaScript / TypeScript",
  "Rust",
  "Solidity",
  "HTML / CSS",
] as const;

/**
 * Regulated + commercial domains the principal has delivered for — framed honestly as the source of
 * the right instincts for federal work (compliance awareness, data sensitivity), NOT as past federal
 * performance, which the firm does not yet have.
 */
export const PRINCIPAL_DOMAINS = ["legal", "medical", "ecommerce"] as const;

/** Primary NAICS the capabilities map to. Confirm/adjust before launch. */
export const NAICS = [
  { code: "541511", label: "Custom Computer Programming Services" },
  { code: "541512", label: "Computer Systems Design Services" },
  { code: "541519", label: "Other Computer Related Services" },
] as const;

/** The four offerings — list ONLY what the firm actually does. */
export interface Capability {
  title: string;
  summary: string;
}
export const CAPABILITIES: readonly Capability[] = [
  {
    title: "Custom software development",
    summary: "Full-stack systems built to spec in Python, JavaScript/TypeScript, and Rust.",
  },
  {
    title: "Database systems design & engineering",
    summary: "Data modeling and database-backed applications designed for integrity and scale.",
  },
  {
    title: "UX/UI design & accessibility",
    summary: "Usable, inclusive interfaces engineered to Section 508 / WCAG 2.1 AA.",
  },
  {
    title: "Systems design, integration & modernization",
    summary: "Legacy modernization, systems integration, and web-application delivery.",
  },
] as const;

/**
 * Credential display state. "confirmed" = true and final; "assigned" = the firm holds it but the
 * literal value is withheld here; "pending" = not yet issued (shown as an obvious placeholder, NEVER a
 * fabricated value). The UI renders a visible badge for anything that is not "confirmed".
 */
export type CredentialState = "confirmed" | "assigned" | "pending";
export interface Credential {
  label: string;
  value: string;
  state: CredentialState;
  note?: string;
}
export const CREDENTIALS: readonly Credential[] = [
  { label: "SAM.gov registration", value: "Active", state: "confirmed" },
  {
    label: "Unique Entity ID (UEI)",
    value: "Assigned",
    state: "assigned",
    note: "Identifier provided to agencies and primes on request.",
  },
  { label: "CAGE code", value: "Pending assignment", state: "pending" },
  { label: "Business size", value: "Small business", state: "confirmed" },
] as const;

/**
 * Direct email/phone are not yet published — the working contact channel is the form (which records an
 * inquiry for human follow-up). Modelled as a pending placeholder so the page never shows a fabricated
 * address or number (truthfulness contract). The operator publishes these before launch.
 */
export const DIRECT_CONTACT_STATE: CredentialState = "pending";

/** The downloadable capability statement is a placeholder until the final PDF is produced. */
export const CAPABILITY_STATEMENT_STATE: CredentialState = "pending";

/** Marketing nav (the public header). Paths are all outside the /admin|/portal auth matcher. */
export const NAV_LINKS = [
  { href: "/capabilities", label: "Capabilities" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
