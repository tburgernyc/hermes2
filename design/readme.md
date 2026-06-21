# BurgerGov Design System

The design system for **BurgerGov** — the public brand of **Burger Consulting LLC**, a founder-led federal IT contracting firm. It powers the public marketing site and the authenticated operations platform (internally codenamed **Hermes**): an autonomous engine that takes a raw client inquiry through triage, subcontractor sourcing, compliance-checked pricing, and a human-approved, fully-costed bid.

This system captures the **"studio" visual language** of that product: a luminous off-white ground, glassmorphism surfaces, deep federal navy as the single brand color, and an extreme-contrast type system (massive thin display headers against tiny tracked mono caps).

---

## Sources

Built by reading the real product code. Explore these to build with higher fidelity:

- **GitHub — `tburgernyc/hermes2`** (https://github.com/tburgernyc/hermes2) — the Next.js monorepo. The authoritative styling lives in:
  - `apps/web/app/globals.css` — design tokens (the studio palette, glass tokens, spacing, radii).
  - `apps/web/app/(marketing)/_components/marketing.module.css` — marketing layout vocabulary (hero, crystal shapes, glass cards).
  - `apps/web/components/ui/*` — the shared primitive library (`Button`, `Field`, `Alert`, `Brand`, `console.tsx`).
  - `apps/web/lib/site.ts` — the single source of truth for brand copy and the truthfulness contract.
- **Logo** — `uploads/burgergovlogo.png` (brushed-metal app icon with US-flag motif).
- **Hero motion** — `uploads/can_you_update_this_video_to_b.mp4` (technical B-roll; copied to `assets/hero.mp4`).

> **Two themes ship in this system.** The original `hermes2` code is a premium **light "Studio"** environment; the written brief pointed toward a *dark* cutting-edge command surface. Rather than choose, the system ships **both as one token-driven theme switch** — see **Themes** below.

---

## Content fundamentals

How BurgerGov writes. The governing principle is a **truthfulness contract** (from `CLAUDE.md` / `site.ts`): every public claim must be literally true *today*.

- **Voice — plain, precise, accountable.** Declarative and unembellished. "What the firm holds today, stated plainly." No hype, no superlatives, no invented metrics. The firm is young and says so.
- **Person — "we" for the firm, "you" for the reader.** "We will share a summary of capabilities." "For prime contractors that need a capable subcontractor…" The founder is named directly ("Timothy Burger personally designs and builds every engagement") — founder accountability is the core trust signal.
- **Casing — sentence case everywhere** in prose and headings ("Credentials & registrations", "Who we work with"). The *only* uppercase is the tracked mono-caps treatment for labels, nav, kickers, and table headers (a visual style, not a writing style).
- **Honesty markers.** Anything not yet issued is labelled, never faked: a CAGE code reads "Pending assignment" with a visible badge; contact details are "published at launch". Never a plausible-looking fake identifier.
- **Domain register.** Federal-contracting vocabulary used precisely: *solicitation, RFQ, NAICS, UEI, CAGE, SAM.gov, set-aside, prime, teaming partner, period of performance, pay-when-paid, Section 508, WCAG 2.1 AA.*
- **No emoji.** None in product copy or UI. Tone is institutional, not playful.
- **Example lines:**
  - Hero: *"Federal IT, engineered to spec by an accountable owner."*
  - Tagline: *"Custom software, database systems, and accessible interfaces — built to spec for government."*
  - Admin: *"Nothing here is sent or advanced without your explicit approval."*

---

## Themes

The system is **token-driven and dual-theme**. Every component and UI kit reads the same semantic token names, so a single attribute re-skins the entire surface. Set `data-theme="command"` on any ancestor (or `<html>`) to switch; absence of the attribute is the default light theme.

- **Studio (light, default)** — luminous off-white ground, navy primary, glassmorphism. The shipped `hermes2` aesthetic. Calm, institutional, accessible.
- **Command (dark)** — a near-black "void" (`#09090b`), hyper-blue (`#3b82f6`) action color, an emerald automation **signal**, ambient mesh glows + a faint HUD grid. The cutting-edge command-surface direction. Defined in `tokens/theme-command.css`.

Both themes share **one type schema** — the same families (`--font-sans`, `--font-display`, `--font-mono`) and the same display weight (`--weight-display`). Command re-themes color, glass, and shadow only; typography is identical to Studio. Both UI kits default to **Command** and expose a light/dark toggle (persisted to `localStorage`).

---

## Visual foundations

- **Background.** A luminous off-white ground (`--studio-bg #f7f8fb`), lit by two very faint off-axis radial gradients (a cool blue at top-right, a cyan at bottom-left) that read as ambient "studio" light. Alternating sections use a slightly cooler tint (`--studio-bg-tint #eef2f8`) bounded by hairline borders. No dark mode in the shipped product.
- **Color.** One brand color: **federal navy** (`--studio-primary #0b2e59`), used for primary actions (as a subtle `#154a86 → #0b2e59` vertical gradient), the brand mark, and emphasis. Interactive blue (`#1457c9`) for links. Everything else is neutral slate ink. Semantic state is the *only* other use of color — info (navy/blue), success (green), warn (amber), danger (red) — each a tinted surface + matching border + AA-contrast text.
- **Type.** The brand voice is **Schibsted Grotesk** — a modern, professional, quietly chic grotesque — with **JetBrains Mono** for all tabular/data/label work (both via Google Fonts; `tokens/fonts.css`). **Extreme contrast** is the signature: display headers are heavy and tightly tracked in Command (weight 800), thin and airy in Studio (weight 300); against them sit tiny **mono caps** — uppercase, weight 600, wide tracking (0.12em nav, 0.18em kicker). Body is the sans at 1rem/1.6, capped ~68ch. Numeric/tabular data is always mono so columns align.
- **Surfaces & cards.** The **glassmorphism engine**: frosted translucent panels with `backdrop-filter: blur(14–16px)`, a 1px light-catching edge (`--glass-border`), an inner top highlight, and a soft diffuse drop shadow. Cards are generously rounded (marketing `22px`, console `14px`). A complementary **neumorphic (soft-UI)** treatment — dual-light extrusion via `--neu-shadow` / `--neu-inset` — is used sparingly for tactile accents (theme toggles, hero metric tiles); it presses inward on `:active`.
- **Motion.** Quick and ambient, with a spring curve (`--ease-spring`) for tactile feedback. The marketing hero carries a **CSS-3D engine scene** — orbital rings rotating in perspective around a glowing core, floating data plates, and cursor-driven parallax tilt — plus staggered entrance reveals, an animated gradient accent word, a primary-CTA shimmer, and count-up metrics. Interactive transitions are ~0.15–0.22s; everything is gated by `prefers-reduced-motion`, and reveals use a transition + mount-class pattern so the resting state is always visible (print/capture-safe).
- **Borders & radii.** Hairlines are `--studio-line #e2e8f0`. Radius scale: `8` (inputs/chips) → `14` (console cards) → `22` (marketing cards) → `999` (buttons, badges, the nav pill).
- **Shadows.** Two-layer diffuse glass shadow (`--glass-shadow`) for rest; on hover an additional cool navy "iris" lift (`--iris-shadow`). Primary buttons carry their own navy glow.
- **Backgrounds / decoration.** Surfaces sit over an ambient **mesh** (soft radial glows of primary + signal) and a faint **HUD grid**, masked so it fades off the content. The marketing hero replaces flat decoration with the CSS-3D engine scene. Imagery, where used, is cool/technical B-roll behind a navy/blue wash.
- **Hover / press.** Hover = a small upward translate + stronger shadow (and a darker primary gradient on buttons); nav links grow an underline; cards lift with an iris glow. Neumorphic accents press inward on `:active`. Focus is a visible 3px ring (`:focus-visible`).
- **Transparency & blur.** Used deliberately for *chrome and elevation* (sticky header pill, app nav, cards, auth card) so foreground panels feel like physical lenses over the lit ground — not as flat fills.
- **Layout.** Fixed `1080px` content measure, centered. Sticky glass nav. 4px-based spacing rhythm. Generous vertical section padding (`clamp(3.5rem, 7vw, 6rem)`).
- **Accessibility.** Every text/background pair is chosen for WCAG 2.1 AA; the product targets Section 508 / WCAG 2.1 AA as a baseline.

---

## Iconography

- **App / brand mark.** `assets/burgergov-logo.png` — a brushed-aluminium app icon with an abstracted US-flag-and-Capitol motif and the "BURGERGOV.com" wordmark. Use as favicon/app-store-style mark and the marketing brand anchor. `assets/icon.svg` is the simple navy "B" monogram favicon.
- **In-app lockup.** App chrome (nav, auth cards, token pages) uses an **inline-SVG monogram** — a navy rounded-square with a white "B" — beside the "BurgerGov" wordmark (the `Brand` component). Inline SVG by design: no binary dependency, CSP-clean, crisp at any size.
- **UI icons.** The shipped product is **deliberately icon-light** — it leans on tracked mono-caps labels, the amber placeholder dot, and status badges rather than an icon set. There is **no icon font and no icon library** in the codebase. The decorative spark glyph in the hero motion frame is the only incidental mark.
- **If you need icons**, introduce a thin-stroke set (e.g. **Lucide**, ~1.5px stroke) to match the light, precise aesthetic — and flag it as an addition, since it is not in the source product. Keep them sparse and monochrome (ink or muted slate).
- **No emoji, ever** — in UI or copy.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (links this one file). `@import` manifest only.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `theme-command.css` (dark theme), `base.css`.
- `assets/` — `burgergov-logo.png` (app icon), `icon.svg` (monogram favicon), `hero.mp4` + `hero-poster.png` (hero B-roll).
- `readme.md` (this file) · `SKILL.md` (portable skill manifest).

**Components** (`components/`, namespace `window.BurgerGovDesignSystem_d0c3b4`)
- `core/` — `Button`, `Cta`, `Badge`, `Card`, `PlaceholderBadge`
- `forms/` — `Field`, `Select`
- `feedback/` — `Alert`, `Stat`
- `brand/` — `Brand`

Each has a `.jsx`, a `.d.ts` (props contract), a `.prompt.md` (usage), and a group `@dsCard` HTML.

**Foundation cards** (`guidelines/`) — Colors (brand, neutral, tones), Type (display, body, mono), Spacing (scale, radii, elevation), Brand (logo, monogram, motion).

**UI kits** (`ui_kits/`) — both default to the **Command** dark theme with a light/dark toggle, and are **cross-linked** (marketing → portals → dashboards).
- `marketing/` — the public site: animated hero with live metrics, the six-stage **autonomous engine** pipeline, capabilities, a **two-portal split** (Subcontractor / Admin), credentials, principal, CTA band. Routes to both console logins.
- `console/` — the operations platform: **split Subcontractor + Admin logins** (admin adds a TOTP step), admin morning brief, **split-view approvals** with a **long-press release gate**, vendor dashboard, Open RFQs, quoting ledger, and compliance documents. Hash-routable (`#vendor-login`, `#admin-login`, `#admin`, …) so the marketing site deep-links in.

**Starting points** — `Button`, `Card`, and both UI kit `index.html` files are tagged for the consuming-project picker.
