# Console UI Kit — BurgerGov admin + vendor portal

A dual-theme, interactive recreation of the **authenticated operations platform** — the human-in-the-loop admin console and the subcontractor portal. Defaults to the dark **Command** theme; the nav toggle flips to light **Studio**.

## Run
Open `index.html` (boots on the **Admin sign-in**). It is **hash-routable**, so the marketing site deep-links straight to a screen:

| Hash | Screen |
|---|---|
| `#admin-login` | Admin sign-in (split screen) |
| `#admin-totp` | TOTP one-time-passcode step |
| `#admin` | Morning brief |
| `#approvals` | HITL approvals |
| `#approval-detail` | Split-view approval + release gate |
| `#vendor-login` | Subcontractor sign-in |
| `#vendor` | Subcontractor dashboard |
| `#rfqs` · `#quote` · `#documents` | Open RFQs · quote ledger · documents |

## Screens
- **Split logins** — branded aside + form; admin flows through a 6-cell **TOTP** screen (auto-advances, self-submits) before the console; vendor signs straight in.
- **Morning brief** — stat grid + triaged solicitations with feasibility score bars + 72h deadlines.
- **Approvals** — the HITL gate; each action fires a success Alert.
- **Approval detail** — **asymmetrical split-view** (locked source solicitation ↔ editable AI evaluation, low-confidence rows amber-flagged) + the **long-press release gate** (hold 1.5s to dispatch).
- **Vendor dashboard / Open RFQs / Quote ledger / Documents** — the subcontractor surface, including a drop-zone and a totaled quoting ledger.

## Files
- `index.html` — shell, hash router, theme state, ambient mesh + grid.
- `console-auth.jsx` — `AppNav`, `PageHeader`, `AuthScreen` (split login), `TotpScreen`, theme button.
- `console-views.jsx` — admin + vendor dashboards, `ReleaseGate`, split-view detail.
- `console.css` — theme-aware dense console layout on the DS tokens.
- `data.js` — `window.CONSOLE` synthetic operations data.

## Composes
DS primitives: `Brand`, `Button`, `Field`, `Badge`, `Alert`.
