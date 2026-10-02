import Alpine from "alpinejs";
import { APPS, APP_IDS, originFor, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, isDarkMode, logoSvg, themeIcons, toggleTheme } from "@mf-all/ui";
import { lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
import { loadWidget } from "../lib/widgets";

const SELF: AppId = "alpine";
const MAX_ENTRIES = 30;

type CardStatus = "loading" | "ready" | "error";

/**
 * The host page shell, written HTML-first: index.html carries the markup
 * (`x-data="mfShell"`), this component carries the state and the federated
 * widget mounting. Alpine's reactivity proxies keep the markup in sync.
 */
export function startShell(Alpine: typeof import("alpinejs").default): void {
  Alpine.data("mfShell", () => ({
    self: SELF,
    selfLabel: APPS[SELF].label,
    selfPort: APPS[SELF].port,
    appIds: APP_IDS,
    apps: APPS,
    frameworks: FRAMEWORKS,
    themeIcons,

    dark: isDarkMode(),
    shared: sharedCounter.get(),
    last: lastInteraction.get() as { app: string; at: number } | null,
    entries: [] as ActivityDetail[],
    state: Object.fromEntries(
      APP_IDS.map((id) => [id, { status: "loading" as CardStatus, error: "", loadMs: null as number | null }]),
    ),
    autoRetried: Object.fromEntries(APP_IDS.map((id) => [id, false])) as Record<string, boolean>,
    disposes: Object.fromEntries(
      APP_IDS.map((id) => [id, null]),
    ) as Record<string, (() => void) | null>,
    loadSeq: Object.fromEntries(APP_IDS.map((id) => [id, 0])) as Record<string, number>,

    logoSvg(id: string, size = 14) {
      return logoSvg(id as AppId, size);
    },

    labelOf(id: string): string {
      return (FRAMEWORKS as unknown as Record<string, { label: string }>)[id]?.label ?? id;
    },

    pageUrl(id: string): string {
      return id === SELF ? "/" : originFor(id as AppId);
    },

    statusDot(id: string): string {
      const status = this.state[id].status;
      return status === "loading"
        ? "animate-pulse bg-amber-400"
        : status === "ready"
          ? "bg-ok"
          : "bg-err";
    },

    onToggleTheme(): void {
      this.dark = toggleTheme();
    },

    async mountWidget(id: string): Promise<void> {
      this.loadSeq[id] = (this.loadSeq[id] ?? 0) + 1;
      const seq = this.loadSeq[id];
      const state = this.state[id];

      // Tear down any previous instance, then retry from a clean container.
      this.disposes[id]?.();
      this.disposes[id] = null;
      const container = document.querySelector<HTMLElement>(`[data-card-container="${id}"]`);
      if (container) container.innerHTML = "";
      state.status = "loading";
      state.error = "";

      try {
        const t0 = performance.now();
        const widget = await loadWidget(id as AppId);
        if (seq !== this.loadSeq[id]) return;
        const target = document.querySelector<HTMLElement>(`[data-card-container="${id}"]`);
        if (!target) return;

        const result = widget.mount(target);
        if (result instanceof Promise) {
          const dispose = await result;
          if (seq !== this.loadSeq[id]) {
            dispose?.();
            return;
          }
          this.disposes[id] = dispose ?? null;
        } else {
          this.disposes[id] = result;
        }
        state.loadMs = Math.round(performance.now() - t0);
        state.status = "ready";
      } catch (error) {
        if (seq !== this.loadSeq[id]) return;
        console.error(`[mf] failed to load ${APPS[id as AppId].mfName}/widget`, error);
        state.error = error instanceof Error ? error.message : String(error);
        state.status = "error";
        // Self-heal transient cold-start failures with one automatic retry.
        if (!this.autoRetried[id]) {
          this.autoRetried[id] = true;
          setTimeout(() => {
            if (seq === this.loadSeq[id] && state.status === "error") void this.mountWidget(id);
          }, 2500);
        }
      } finally {
        // Watchdog: a hung remote load gets one automatic remount.
        setTimeout(() => {
          if (seq === this.loadSeq[id] && state.status === "loading") {
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
            void this.mountWidget(id);
          }
        }, 12000);
      }
    },

    retry(id: string): void {
      void this.mountWidget(id);
    },

    init(): void {
      const unsubCounter = sharedCounter.subscribe((v) => (this.shared = v));
      const unsubLast = lastInteraction.subscribe((v) => (this.last = v));
      const onActivity = (event: Event): void => {
        const detail = (event as CustomEvent<ActivityDetail>).detail;
        this.entries = [detail, ...this.entries].slice(0, MAX_ENTRIES);
      };
      window.addEventListener(ACTIVITY_EVENT, onActivity);
      this.destroy = () => {
        unsubCounter();
        unsubLast();
        window.removeEventListener(ACTIVITY_EVENT, onActivity);
        APP_IDS.forEach((id) => this.disposes[id]?.());
      };

      this.$nextTick(() => APP_IDS.forEach((id) => void this.mountWidget(id)));
    },
  }));
}
