# mf-all — Module Federation Playground

**9 framework apps · every page hosts all 9 widgets · every remote is also a host.**

One page per framework — Vue, React, Angular, Svelte, Solid, Preact and Lit —
each serving the identical playground: a widget grid with **all 9 frameworks'
widgets as federated remote micro-frontends**, a cross-framework shared
counter, and a live activity log. Powered by
[Module Federation 2.0](https://module-federation.io) via
[`@module-federation/vite`](https://github.com/module-federation/vite)
(the Vite-team-recommended adapter) — every app is **both host and provider**
(bidirectional federation).

```
                    ┌──────────────────────────────┐
                    │      the 9-widget grid       │
                    │  Vue  React  Angular  Svelte │
                    │  Solid Preact  Lit  Alpine   │
                    │  jQuery                      │
                    └──────────────────────────────┘
   page :5173 (Vue) ──┐    every widget is a
   page :5174 (React) ├──── federated remote — loaded via
   page :5175 (Angular)──  loadRemote from its app's
   …                  │    remoteEntry / mf-manifest.json
   page :5181 (jQuery)┘
```

## Run it

```bash
pnpm install
pnpm dev        # boots all 7 dev servers (5173–5179)
```

Open **http://localhost:5173** (or any of the nine). Also available:

```bash
pnpm build      # production build of all 7 apps
pnpm preview    # serve the production builds
pnpm test:e2e   # Playwright suite (boots its own servers; 8 tests)
```

## The apps

| Page | Port | Host framework | Widget internals | MF shared singletons |
|---|---|---|---|---|
| apps/vue | 5173 | Vue 3.5 | `ref`/`computed` | `vue` |
| apps/react | 5174 | React 19 | hooks | `react`, `react-dom` |
| apps/angular | 5175 | Angular 21 (zoneless, via `@analogjs/vite-plugin-angular`) | signals | `@angular/core`, `rxjs`, `tslib` |
| apps/svelte | 5176 | Svelte 5 | runes (`$state`) | — (self-contained by design) |
| apps/solid | 5177 | Solid 1.9 | `createSignal` | `solid-js` |
| apps/preact | 5178 | Preact 10 | hooks (4 kB runtime) | `preact` |
| apps/lit | 5179 | Lit 3 | **custom element** (shadow DOM) | — (self-contained by design) |
| apps/alpine | 5180 | Alpine.js 3 | directives (`x-data`, HTML-first shell) | — (self-contained by design) |
| apps/jquery | 5181 | jQuery 4 | plain DOM + events (the "legacy remote") | — (self-contained by design) |

Each page renders the other six widgets as federated remotes, and its own
widget from a local import (a network hop to yourself buys nothing —
self-consumption through the federation contract is fully supported too and
was verified during development).

## How it fits together

- **Widget contract** (`packages/widget-contract`) — every app exposes
  `./widget`: a `mount(el) => unmount()` function, framework-agnostic.
  React uses `createRoot`, Vue `createApp`, Svelte 5 `mount()`, Solid
  `render()`, Preact `render`, Angular `createApplication()` +
  `appRef.bootstrap()` (teardown = `appRef.destroy()`), Lit
  `customElements.define` + `createElement`. Types flow through the
  ambient `declare module "*/widget"` in each host's `remotes.d.ts`.
- **Remote registry** (`packages/app-registry`) — single source of truth for
  names, ports and URLs. Remotes point at `mf-manifest.json` (`manifest:
  true` everywhere); override any origin per environment with
  `MF_ORIGIN_<APP>` at build time (e.g. `MF_ORIGIN_REACT=https://react.acme.com`).
- **Shared state** (`packages/shared-store`) — a counter + last-interaction
  atom whose instances are memoized on the platform global, so exactly one
  store exists per page no matter how many copies of the module the
  federation meshes load. Widgets also emit `CustomEvent("mf:activity")`
  which the host pages aggregate into the activity log — cross-framework
  communication without coupling.
- **Design system** (`packages/ui`) — Tailwind v4 `@theme` tokens (one
  `tokens.css` imported by every app) + the framework logo kit. Tokens are
  plain CSS variables, so they style the Lit widget through its shadow DOM.
  Widgets ship Tailwind's theme+utilities **without preflight** — the host
  page owns the single reset. Light + dark themes from the same tokens:
  every header has a toggle (persisted via cookie, shared across the nine
  dev-server origins), defaults to the OS preference, and applies before
  first paint (no flash).
- **Resilience** — the official `@module-federation/retry-plugin` (3 retries,
  backoff, cache-busting query) plus a per-widget error card with the error
  message, one automatic retry and a 12 s watchdog remount; host pages
  degrade gracefully when a remote is down (stop any dev server and watch).
- **Observability** — the official `@module-federation/observability-plugin`;
  load traces are summarized to the console and inspectable via
  `window.__FEDERATION__.__OBSERVABILITY__`.

## Production practices baked in

- Env-driven remote registry with stable expose keys; manifests (not entry
  files) as the deployment contract
- `MF_BUILD_ORIGIN=<origin> pnpm build` → absolute asset URLs for
  cross-origin chunk resolution
- Retry plugin + error boundaries + watchdog (the three official resilience
  layers); widgets degrade independently
- `deploy/nginx.conf` — the caching/CORS contract: `no-cache` for
  manifest/remoteEntry, `immutable` for hashed chunks, CORS on remote
  origins, keep old chunks for running sessions
- Playwright e2e over all nine pages (`webServer` array), including
  cross-framework state assertions — runs against dev servers and, with
  `PLAYWRIGHT_PROD=1`, against production previews (CI does both)
- pnpm workspaces + `catalog:` for version alignment; TypeScript everywhere

## The sharp edges we hit (and documented)

Running nine bidirectional Vite-federation apps in dev is beyond every
official example (they are 2-app pairs). Notes for anyone pushing further:

- **HMR must be off** (`server.hmr: false` everywhere). Refresh transforms
  (react-refresh, @prefresh) inject page-local preamble dependencies into
  widget code, which must stay evaluatable inside foreign hosts; HMR of
  consumed remote modules is unsupported anyway (full-reload semantics).
- **Never statically import a peer's expose** — always via the lazy loaders
  map (`src/lib/widgets.ts`). The plugin registers remotes when the
  rewritten imports run; the intermittent "one widget never mounts" dev
  hang is the known deadlock family (#180/#733/#1144) — the watchdog + a
  reload recovers, and the production build is unaffected.
- **Angular + Analog**: `esbuild` must stay enabled for decorator-less TS
  (Analog switches it off; its emit only covers files in its program),
  `noEmit: false` and `isolatedModules: false` in tsconfig, a
  `tsconfig.app.json` must exist, and workspace packages need
  `transformFilter` so the Angular compiler doesn't clobber them.
- **Cross-widget state** via share-scope negotiation proved unreliable in a
  9-way mesh (per-app cliques); the platform-memoized store is the
  deterministic pattern here. Framework singletons (`vue`, `react`,
  `@angular/core`, …) negotiate fine and remain shared.

## References

- [module-federation/vite](https://github.com/module-federation/vite) ·
  [docs](https://module-federation.io) ·
  [per-framework vite examples](https://github.com/gioboa/module-federation-vite-examples)
- [module-federation-examples](https://github.com/module-federation/module-federation-examples)
  (`module-federation-vite-angular` is the Angular blueprint)
- Production adoption: Lululemon, Best Buy, Adidas, Epic Games, Shopify
  Partners ([showcase](https://module-federation.io/showcase.html))
