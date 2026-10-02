import $ from "jquery";
import "../app.css";
import { APPS, APP_IDS, originFor } from "@mf-all/app-registry";
import { FRAMEWORKS, isDarkMode, logoSvg, themeIcons, toggleTheme } from "@mf-all/ui";
import { lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
import { loadWidget } from "../lib/widgets";

const SELF = "jquery";
const MAX_ENTRIES = 30;

type CardStatus = "loading" | "ready" | "error";

const labelOf = (id: string): string =>
  (FRAMEWORKS as unknown as Record<string, { label: string }>)[id]?.label ?? id;

const cardHtml = (id: string): string => {
  const cfg = APPS[id];
  const meta = FRAMEWORKS[id];
  return `
    <article
      class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card"
      data-card="${id}"
    >
      <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span class="inline-block shrink-0">${logoSvg(id, 18)}</span>
        <span class="text-sm font-semibold">${meta.label}</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style="background-color: ${meta.color}1a; color: ${meta.color}"
        >${cfg.mfName}</span>
        <span class="ml-auto flex items-center gap-2">
          <span class="font-mono text-[11px] text-muted">:${cfg.port}</span>
          <span
            data-role="loadtime"
            data-mf-loadtime
            class="hidden font-mono text-[10px] text-muted"
          ></span>
          <span data-role="dot" class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"></span>
        </span>
      </header>

      <div class="relative flex-1 p-4">
        <div data-role="skeleton" class="animate-pulse space-y-3">
          <div class="h-8 w-28 rounded-lg bg-border/70"></div>
          <div class="h-4 w-44 rounded bg-border/50"></div>
          <div class="h-8 w-32 rounded-lg bg-border/70"></div>
          <div class="h-4 w-40 rounded bg-border/50"></div>
        </div>

        <div data-role="error" class="hidden flex-col items-center justify-center gap-2 py-6 text-center">
          <p class="text-xs font-medium text-err">
            Couldn't load <span class="font-mono">${cfg.mfName}/widget</span>
          </p>
          <p class="text-[11px] text-muted">
            Is the remote dev server on :${cfg.port} running?
          </p>
          <p
            data-role="errmsg"
            class="mt-1 hidden max-h-16 max-w-full overflow-hidden rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted"
          ></p>
          <button
            type="button"
            data-role="retry"
            class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
          >
            Retry
          </button>
        </div>

        <div data-role="container" class="min-h-[120px]"></div>
      </div>
    </article>`;
};

/**
 * The host page shell, written the jQuery way: one composed DOM template,
 * targeted updates via subscriptions, direct event wiring.
 */
export function startShell(): void {
  let dark = isDarkMode();
  const entries: ActivityDetail[] = [];
  const disposes: Record<string, (() => void) | null> = {};
  const loadSeq: Record<string, number> = {};
  const autoRetried: Record<string, boolean> = {};
  const settled: Record<string, boolean> = {};

  const navHtml = APP_IDS.map(
    (id) => `
      <a
        href="${id === SELF ? "/" : originFor(id)}"
        data-nav="${id}"
        class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent-soft hover:text-ink ${
          id === SELF ? "bg-accent-soft text-accent" : "text-muted"
        }"
      >
        <span class="inline-block">${logoSvg(id, 14)}</span>
        ${APPS[id].label}
      </a>`,
  ).join("");

  const frame = $(`
    <div class="min-h-screen">
      <header class="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3">
          <span class="shrink-0">${logoSvg(SELF, 22)}</span>
          <span class="text-sm font-semibold">${APPS[SELF].label}</span>
          <span
            class="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink"
          >host</span>
          <span class="hidden font-mono text-[11px] text-muted sm:inline">:${APPS[SELF].port}</span>
          <nav class="ml-auto flex items-center gap-1 overflow-x-auto">${navHtml}</nav>
          <button
            type="button"
            data-role="theme-toggle"
            class="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-accent-soft hover:text-ink"
          >
            <span class="inline-block">${dark ? themeIcons.sun : themeIcons.moon}</span>
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section>
          <h1 class="text-2xl font-semibold tracking-tight">Module Federation Playground</h1>
          <p class="mt-1 text-sm text-muted">
            9 framework apps — every page hosts all 9 widgets as federated remotes. This page is
            hosted by <b class="font-medium text-ink">${APPS[SELF].label}</b>, and jQuery itself is a
            remote everywhere else.
          </p>
        </section>

        <section
          data-role="strip"
          class="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 shadow-card"
        >
          <div>
            <p class="text-sm font-semibold">Shared counter</p>
            <p class="text-xs text-muted">
              platform-memoized atom — one instance across all frameworks
            </p>
          </div>
          <div class="flex items-center gap-5">
            <div data-role="strip-last" class="flex items-center gap-1.5 text-xs text-muted"></div>
            <span data-role="strip-value" class="font-mono text-3xl font-semibold tabular-nums"
              >0</span
            >
          </div>
        </section>

        <section class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          ${APP_IDS.map(cardHtml).join("")}
        </section>

        <section class="rounded-card border border-border bg-surface p-5 shadow-card">
          <div class="mb-3 flex items-baseline justify-between">
            <h2 class="text-sm font-semibold">Activity log</h2>
            <p class="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
          </div>
          <p data-role="log-empty" class="py-6 text-center text-xs text-muted">
            No activity yet — click around inside the widgets.
          </p>
          <ul data-role="log-list" class="hidden max-h-56 space-y-1.5 overflow-y-auto pr-1"></ul>
        </section>

        <footer class="pb-4 text-center text-[11px] text-muted">
          @module-federation/vite 1.23 · MF runtime 2.9 · 9 apps on ports 5173–5181 · every remote
          is also a host
        </footer>
      </main>
    </div>`);

  $("#app").append(frame);

  const card = (id: string) => $(`[data-card="${id}"]`);
  const setCardStatus = (id: string, status: CardStatus, msg = ""): void => {
    const c = card(id);
    c.find("[data-role='dot']")
      .removeClass("animate-pulse bg-amber-400 bg-ok bg-err")
      .addClass(status === "loading" ? "animate-pulse bg-amber-400" : status === "ready" ? "bg-ok" : "bg-err");
    c.find("[data-role='skeleton']").toggleClass("hidden", status !== "loading");
    c.find("[data-role='error']")
      .toggleClass("hidden", status !== "error")
      .toggleClass("flex", status === "error");
    c.find("[data-role='errmsg']").text(msg).toggleClass("hidden", !msg);
  };

  const renderStripLast = (): void => {
    const last = lastInteraction.get();
    const $el = $("[data-role='strip-last']");
    if (!last) {
      $el.empty();
      return;
    }
    $el
      .empty()
      .append("<span>last:</span>")
      .append(`<span class="inline-block">${logoSvg(last.app, 14)}</span>`)
      .append(`<span class="font-medium text-ink">${labelOf(last.app)}</span>`);
  };

  const renderLog = (): void => {
    const $list = $("[data-role='log-list']");
    $list.empty();
    for (const entry of entries) {
      $list.append(`
        <li class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg">
          <span class="inline-block shrink-0">${logoSvg(entry.app, 14)}</span>
          <span class="font-semibold">${labelOf(entry.app)}</span>
          <span class="truncate text-muted">${entry.message}</span>
          <span class="ml-auto shrink-0 font-mono text-[11px] text-muted"
            >${new Date(entry.at).toLocaleTimeString()}</span
          >
        </li>`);
    }
    $list.toggleClass("hidden", entries.length === 0);
    $("[data-role='log-empty']").toggleClass("hidden", entries.length > 0);
  };

  const mountWidget = async (id: string): Promise<void> => {
    loadSeq[id] = (loadSeq[id] ?? 0) + 1;
    const seq = loadSeq[id];
    const $c = card(id);
    const $container = $c.find("[data-role='container']");
    const prevDispose = disposes[id];
    settled[id] = false;

    // Tear down any previous instance, then retry from a clean container.
    if (prevDispose) prevDispose();
    disposes[id] = null;
    $container.empty();
    setCardStatus(id, "loading");

    try {
      const t0 = performance.now();
      const widget = await loadWidget(id);
      if (seq !== loadSeq[id]) return;

      const result = widget.mount($container[0]!);
      if (result instanceof Promise) {
        const dispose = await result;
        if (seq !== loadSeq[id]) {
          dispose?.();
          return;
        }
        disposes[id] = dispose ?? null;
      } else {
        disposes[id] = result;
      }
      $c
        .find("[data-role='loadtime']")
        .text(`${Math.round(performance.now() - t0)} ms`)
        .removeClass("hidden");
      setCardStatus(id, "ready");
      settled[id] = true;
    } catch (error) {
      settled[id] = true;
      if (seq !== loadSeq[id]) return;
      console.error(`[mf] failed to load ${APPS[id].mfName}/widget`, error);
      setCardStatus(id, "error", error instanceof Error ? error.message : String(error));
      // Self-heal transient cold-start failures with one automatic retry.
      if (!autoRetried[id]) {
        autoRetried[id] = true;
        setTimeout(() => {
          if (seq === loadSeq[id]) void mountWidget(id);
        }, 2500);
      }
    } finally {
      // Watchdog: a hung remote load (promise never settles) gets the same
      // single automatic remount.
      setTimeout(() => {
        if (!settled[id] && seq === loadSeq[id]) {
          try {
            const key = "mf-recovery";
            const lastRecovery = Number(sessionStorage.getItem(key) ?? "0");
            if (Date.now() - lastRecovery > 15000) {
              sessionStorage.setItem(key, String(Date.now()));
              location.reload();
              return;
            }
          } catch {
            // storage unavailable — fall through to the remount
          }
          void mountWidget(id);
        }
      }, 12000);
    }
  };

  // --- wire up ---------------------------------------------------------------

  // Theme toggle
  $("[data-role='theme-toggle']").on("click", () => {
    dark = toggleTheme();
    $("[data-role='theme-toggle'] span").html(dark ? themeIcons.sun : themeIcons.moon);
  });

  // Widget retries
  APP_IDS.forEach((id) => {
    card(id)
      .find("[data-role='retry']")
      .on("click", () => void mountWidget(id));
  });

  // Shared state
  sharedCounter.subscribe((v) => $("[data-role='strip-value']").text(String(v)));
  lastInteraction.subscribe(() => renderStripLast());

  // Activity feed
  window.addEventListener(ACTIVITY_EVENT, (event) => {
    const detail = (event as CustomEvent<ActivityDetail>).detail;
    entries.unshift(detail);
    entries.splice(MAX_ENTRIES);
    renderLog();
  });

  renderStripLast();

  // Mount all federated widgets
  APP_IDS.forEach((id) => void mountWidget(id));
}
