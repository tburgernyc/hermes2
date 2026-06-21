# Marketing UI Kit — BurgerGov public site

A world-class recreation of the **public marketing layer**, dual-theme and interactive. Defaults to the dark **Command** theme; the nav toggle switches to light **Studio**. Built on the DS tokens, so the whole surface re-skins from one attribute.

## Run
Open `index.html`. The nav routes between **Home → Capabilities → About → Contact**; the hero metrics count up; the theme toggle (☀/☾) flips Command ↔ Studio (persisted). The header and the "Two portals" section deep-link into the console kit (`../console/index.html#vendor-login` / `#admin-login`).

## Home sections
1. **Hero** — live "engine online" status pill, heavy headline with a blue→emerald gradient accent, dual CTAs, and an animated **metric strip**.
2. **Autonomous engine** — the six-stage pipeline (Inquiry → Triage → Sourcing → Pricing → **Human approval** → Bid) as glass stage-cards; the human gate is emerald-marked.
3. **Capabilities** — four glass cards with hover glow.
4. **Two portals** — a split into **Subcontractor Portal** and **Admin Console**, each with a login CTA that routes into the console.
5. **Credentials** — the registrations record card (pending items badged).
6. **Principal** — founder accountability + stack tags.
7. **CTA band** + footer (with portal links).

## Files
- `index.html` — app shell, client router, theme state, ambient mesh + grid.
- `marketing-chrome.jsx` — `Header` (nav + theme toggle + portal entries) + `Footer`.
- `marketing-views.jsx` — `HomeView`, `CapabilitiesView`, `AboutView`, `ContactView`, the count-up hook, `Credentials`, `PortalCard`.
- `marketing.css` — theme-aware studio/command layout vocabulary on the DS tokens.
- `data.js` — `window.SITE` brand content (mirrors `lib/site.ts`) + pipeline, metrics, portals.

## Composes
DS primitives: `Cta`, `Button`, `Field`, `PlaceholderBadge`.

> Truthfulness contract: every claim is literally true today. Anything not yet issued (CAGE code, mailing address, direct contact) renders as an explicit placeholder.
