import { useState, useSyncExternalStore } from "react";
import { APPS, APP_IDS, originFor, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, isDarkMode, logoSvg, themeIcons, toggleTheme } from "@mf-all/ui";
import { lastInteraction, sharedCounter } from "@mf-all/shared-store";
import type { Atom } from "nanostores";
import { ActivityLog } from "./components/ActivityLog";
import { WidgetCard } from "./components/WidgetCard";

const SELF: AppId = "react";
const self = APPS[SELF];

function useStore<T>(store: Atom<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

function pageUrl(id: AppId): string {
  return id === SELF ? "/" : originFor(id);
}

export function App() {
  const shared = useStore(sharedCounter);
  const last = useStore(lastInteraction);
  const [dark, setDark] = useState(isDarkMode);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3">
          <span
            className="shrink-0 [&>svg]:h-[22px] [&>svg]:w-[22px]"
            dangerouslySetInnerHTML={{ __html: logoSvg(SELF, 22) }}
          />
          <span className="text-sm font-semibold">{self.label}</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink">
            host
          </span>
          <span className="hidden font-mono text-[11px] text-muted sm:inline">:{self.port}</span>
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
            {APP_IDS.map((id) => (
              <a
                key={id}
                href={pageUrl(id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent-soft hover:text-ink ${
                  id === SELF ? "bg-accent-soft text-accent" : "text-muted"
                }`}
              >
                <span
                  className="[&>svg]:h-3.5 [&>svg]:w-3.5"
                  dangerouslySetInnerHTML={{ __html: logoSvg(id, 14) }}
                />
                {APPS[id].label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setDark(toggleTheme())}
            className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-accent-soft hover:text-ink"
          >
            <span
              className="inline-block"
              dangerouslySetInnerHTML={{ __html: dark ? themeIcons.sun : themeIcons.moon }}
            />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Module Federation Playground</h1>
          <p className="mt-1 text-sm text-muted">
            9 framework apps — every page hosts all 9 widgets as federated remotes. This page is
            hosted by <b className="font-medium text-ink">{self.label}</b>, and {self.label} itself
            is a remote everywhere else.
          </p>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 shadow-card">
          <div>
            <p className="text-sm font-semibold">Shared counter</p>
            <p className="text-xs text-muted">
              nanostores shared singleton — one instance across all frameworks
            </p>
          </div>
          <div className="flex items-center gap-5">
            {last && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                last:
                <span
                  className="[&>svg]:h-3.5 [&>svg]:w-3.5"
                  dangerouslySetInnerHTML={{ __html: logoSvg(last.app as AppId, 14) }}
                />
                <span className="font-medium text-ink">
                  {FRAMEWORKS[last.app as AppId]?.label}
                </span>
              </div>
            )}
            <span className="font-mono text-3xl font-semibold tabular-nums">{shared}</span>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {APP_IDS.map((id) => (
            <WidgetCard key={id} app={id} />
          ))}
        </section>

        <ActivityLog />

        <footer className="pb-4 text-center text-[11px] text-muted">
          @module-federation/vite 1.23 · MF runtime 2.9 · 7 apps on ports 5173–5179 · every remote
          is also a host
        </footer>
      </main>
    </div>
  );
}
