import { createSignal, For, Show } from "solid-js";
import { APPS, APP_IDS, originFor, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, isDarkMode, logoSvg, themeIcons, toggleTheme } from "@mf-all/ui";
import { lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { ActivityLog } from "./components/ActivityLog";
import { WidgetCard } from "./components/WidgetCard";
import { useStore } from "./lib/store";

const SELF: AppId = "solid";
const self = APPS[SELF];

function pageUrl(id: AppId): string {
  return id === SELF ? "/" : originFor(id);
}

export function App() {
  const shared = useStore(sharedCounter);
  const last = useStore(lastInteraction);
  const [dark, setDark] = createSignal(isDarkMode());

  return (
    <div class="min-h-screen">
      <header class="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3">
          <span class="shrink-0" innerHTML={logoSvg(SELF, 22)} />
          <span class="text-sm font-semibold">{self.label}</span>
          <span class="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink">
            host
          </span>
          <span class="hidden font-mono text-[11px] text-muted sm:inline">:{self.port}</span>
          <nav class="ml-auto flex items-center gap-1 overflow-x-auto">
            <For each={APP_IDS}>
              {(id) => (
                <a
                  href={pageUrl(id)}
                  class={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent-soft hover:text-ink ${
                    id === SELF ? "bg-accent-soft text-accent" : "text-muted"
                  }`}
                >
                  <span class="inline-block" innerHTML={logoSvg(id, 14)} />
                  {APPS[id].label}
                </a>
              )}
            </For>
          </nav>
          <button
            type="button"
            title={dark() ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={dark() ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setDark(toggleTheme())}
            class="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-accent-soft hover:text-ink"
          >
            <span class="inline-block" innerHTML={dark() ? themeIcons.sun : themeIcons.moon} />
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section>
          <h1 class="text-2xl font-semibold tracking-tight">Module Federation Playground</h1>
          <p class="mt-1 text-sm text-muted">
            9 framework apps — every page hosts all 9 widgets as federated remotes. This page is
            hosted by <b class="font-medium text-ink">{self.label}</b>, and {self.label} itself is a
            remote everywhere else.
          </p>
        </section>

        <section class="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 shadow-card">
          <div>
            <p class="text-sm font-semibold">Shared counter</p>
            <p class="text-xs text-muted">
              nanostores shared singleton — one instance across all frameworks
            </p>
          </div>
          <div class="flex items-center gap-5">
            <Show when={last()}>
              {(value) => (
                <div class="flex items-center gap-1.5 text-xs text-muted">
                  last:
                  <span class="inline-block" innerHTML={logoSvg(value().app as AppId, 14)} />
                  <span class="font-medium text-ink">
                    {FRAMEWORKS[value().app as AppId]?.label}
                  </span>
                </div>
              )}
            </Show>
            <span class="font-mono text-3xl font-semibold tabular-nums">{shared()}</span>
          </div>
        </section>

        <section class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <For each={APP_IDS}>{(id) => <WidgetCard app={id} />}</For>
        </section>

        <ActivityLog />

        <footer class="pb-4 text-center text-[11px] text-muted">
          @module-federation/vite 1.23 · MF runtime 2.9 · 7 apps on ports 5173–5179 · every remote
          is also a host
        </footer>
      </main>
    </div>
  );
}
