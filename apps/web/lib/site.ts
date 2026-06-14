// Site-wide constants. Plain TS (no JSX) so unit tests can import these
// without needing a React/JSX transform in the Vitest (node) environment.
export const SITE_TITLE = "Hermes 2.0" as const;
export const SITE_DESCRIPTION =
  "AI-assisted federal IT-contracting PMO for Burger Consulting LLC." as const;
