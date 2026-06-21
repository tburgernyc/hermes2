---
name: burgergov-design
description: Use this skill to generate well-branded interfaces and assets for BurgerGov (Burger Consulting LLC) — a founder-led federal IT contractor — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the "studio" light-mode aesthetic and the Hermes operations platform.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference
- **Brand:** BurgerGov (legal: Burger Consulting LLC). Founder-led federal IT contracting. Domain `burgergov.com`. Principal: Timothy Burger, CEO & Lead Software Designer.
- **Aesthetic:** dual-theme — **Studio** (light, thin display) and **Command** (dark, heavy display); luminous off-white or near-black void, glassmorphism + neumorphic accents, federal navy / hyper-blue primary, emerald signal, extreme-contrast type. Typeface: **Schibsted Grotesk** (display + body) with **JetBrains Mono** for data.
- **Voice:** plain, precise, accountable; sentence case; "we"/"you"; no emoji; truthfulness contract (mark anything not-yet-real as a visible placeholder, never fake it).

## Key files
- `styles.css` — link this for all tokens (colors, type, spacing, glass/shadow effects, base resets).
- `tokens/` — the token sources.
- `assets/` — logo, monogram favicon, hero video + poster.
- `components/` — React primitives (`Button`, `Cta`, `Badge`, `Card`, `PlaceholderBadge`, `Field`, `Select`, `Alert`, `Stat`, `Brand`). Compiled to `_ds_bundle.js`; mount via `window.BurgerGovDesignSystem_d0c3b4`.
- `ui_kits/marketing/` and `ui_kits/console/` — full interactive screen recreations to copy and adapt.
- `guidelines/` — foundation specimen cards.

When building a standalone artifact, link `styles.css`, load `_ds_bundle.js`, and read components from `window.BurgerGovDesignSystem_d0c3b4`. Copy any assets you reference into your output folder.
