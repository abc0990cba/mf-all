# Modul Federation — 8 new widget features, behind tabs (cards stay minimalistic)

Add the 8 interactive features to the remote widget, but **not stacked** — each widget gets a tiny tab switcher at the top of the card. The default tab shows exactly the current two counters, so on load the 9-card grid + host strip page looks (almost) identical to today. Each tab view is 2–4 small rows, so card height grows only by the tab row (~28px). The page layout you like — all 9 remotes on one page, host strip on top — is untouched.

## Tab layout inside every widget

Compact segmented control, 10px uppercase labels, `.mfw-*` vocabulary; active tab + per-tab unseen-activity dots (4px accent dot when something happens while you're on another tab — cleared on view):

| Tab | Contents |
|---|---|
| **Counters** (default) | Local +1, Shared +1, and 9 attribution micro-bars (logo-colored, tooltip = count of Shared+1 clicks per app) |
| **Ball** | The glossy ball (40px CSS circle, pass-counter inside) when this widget holds it — click to pass to a random other app; otherwise "ball at: <logo>"; dot when the ball arrives here |
| **Board** | Shared 5×5 grid of ~12px cells; toggling a cell lights it in all 9 widgets |
| **Chat** | One-line input + Send; last 3 messages from any widget; text rendered safely (`.text()` / framework-safe bindings) |
| **Pulse** | "Ping ×8" button (broadcast `mf:ping`; other widgets flash their card border ~600 ms + count "got: N"), mood emoji + 3 setters (🙂 🎉 🧠, synced everywhere), identity line ("home" vs "guest on :5174") |

Ping flash fires regardless of active tab, so cross-widget events are always visible; unseen events set dots on their tabs. The existing footer ("last: …" + "log event") stays as is.

Active tab is pure local UI state — trivial idiom in all 9 frameworks (useState / ref / $state / signal / property / x-data / class toggle).

## Step 1 — shared packages (unchanged from before)

`packages/shared-store/src/index.ts` — all atoms memoized on `globalThis` like the existing two:
- `ball: Atom<{ holder: AppId | null; passes: number }>` + `passBall(from, to)` — starts at `vue`
- `chat: Atom<ChatMessage[]>` (last 3) + `sendChat(app, text)`
- `grid: Atom<Record<string, boolean>>` keyed `"r-c"` + `toggleCell(r, c)`
- `mood: Atom<string>` + `setMood(app, emoji)`
- `attribution: Atom<Partial<Record<AppId, number>>>`; existing `incrementShared` also bumps it

`packages/widget-contract/src/index.ts` — `PING_EVENT = "mf:ping"`, `PingDetail`, `emitPing(app)`, mirroring the activity event.

## Step 2 — React widget as reference implementation

Extend `apps/react/src/widget/` (Widget.tsx + widget.css): tabs + all 5 views + new CSS classes (`.mfw-tabs`, `.mfw-tab`, `.mfw-dot`, `.mfw-ball`, `.mfw-flash` keyframes, `.mfw-grid`, `.mfw-chat`, `.mfw-bars`, `.mfw-mood`). All new DOM gets `data-mf-tab`, `data-mf-ball`, `data-mf-chat-input`, `data-mf-grid-cell="r-c"`, `data-mf-identity`, etc. for e2e.

## Step 3 — port to the other 8 frameworks (in order)

vue → svelte → solid → preact → lit → alpine → jquery → angular, each following its existing widget idiom (every file already subscribes to 2 atoms — extend that pattern):
- **Lit**: properties + tab state + duplicate new styles inside `static styles` (shadow DOM; tokens inherit through).
- **jQuery**: extend `WIDGET_MARKUP` (no-leading-whitespace rule), tab show/hide + delegated handlers, chat via `.text()`, full unbind in teardown.
- **Alpine**: extend `x-data` state and `x-show` views per its existing mount.
- **Angular**: zoneless signals per its existing widget; no new deps, Analog/esbuild quirks not triggered.

Guardrails from the README: no new runtime deps, no static imports of peer exposes, HMR stays off, all cross-widget state via memoized atoms / `mf:*` events only.

## Step 4 — load-time badge (host-side, no widget space used)

In each of the 9 WidgetCard components: capture `performance.now()` before the lazy widget load and render "N ms" beside the status dot after mount (incl. the self-widget).

## Step 5 — e2e

New `e2e/tests/features.spec.ts`, reusing the shadow-DOM piercing helpers from `mesh.spec.ts`:
- Smoke ×9 pages: widgets render with Counters as active tab (initial look preserved), no error cards, load-time badge present.
- Cross-widget (two different-framework widgets on one page; switch tabs via `data-mf-tab`): ball pass increments passes + moves the footer logo; ping raises "got" count and dots appear on inactive tabs; chat text appears; a toggled cell matches; mood syncs; attribution grows for the clicker; identity shows "home" / "guest on :PORT".

## Step 6 — docs

README: document tabs + features and the new store/event surface.

## Step 7 — verification

- `pnpm dev` + manual pass over all 9 ports after each port step
- `pnpm test:e2e` (dev), then full `pnpm build` + preview e2e (CI parity)

**Acceptance:** 9 pages × 9 widgets, zero error cards; on load each card looks essentially like today (counters + tab row); every feature demonstrably syncs across different-framework widgets; e2e green in dev and prod; no new deps.