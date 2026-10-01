import Alpine from "alpinejs";
import "./widget.css";
import { incrementShared, lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const SELF: AppId = "alpine";
const meta = FRAMEWORKS[SELF];

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * Alpine is HTML-first: the widget is a declarative markup fragment driven
 * by an `Alpine.data` component. `Alpine.initTree(root)` activates the
 * directives inside the injected subtree — without calling `Alpine.start()`,
 * so the widget copy never scans or claims the host page's DOM.
 * Alpine auto-disposes an element's effects when it leaves the DOM; the
 * guarded `destroyTree` call (Alpine 3.14+) just makes that explicit.
 */
const template = `
  <div class="flex h-full flex-col justify-between gap-4" x-data="mfAlpineWidget">
    <div class="space-y-3.5">
      <section>
        <span class="mfw-label">Local · Alpine.data()</span>
        <div class="flex items-center gap-2.5">
          <button type="button" class="mfw-btn" @click="local++">Local +1</button>
          <span class="mfw-value" x-text="local"></span>
        </div>
      </section>

      <section>
        <span class="mfw-label">Shared · platform-memoized atom</span>
        <div class="flex items-center gap-2.5">
          <button type="button" class="mfw-btn-accent" @click="onShared()">Shared +1</button>
          <span class="mfw-value" x-text="shared"></span>
        </div>
      </section>
    </div>

    <div class="flex items-center justify-between">
      <span class="mfw-foot flex items-center gap-1.5">
        last:
        <template x-if="lastApp">
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block" x-html="lastLogo"></span>
            <span class="font-medium text-ink" x-text="lastLabel"></span>
          </span>
        </template>
        <template x-if="!lastApp"><span>—</span></template>
      </span>
      <button
        type="button"
        class="mfw-foot underline-offset-2 hover:text-ink hover:underline"
        @click="onLog()"
      >
        log event
      </button>
    </div>
  </div>
`;

Alpine.data("mfAlpineWidget", () => ({
  local: 0,
  shared: sharedCounter.get(),
  lastApp: null as string | null,
  lastLogo: "",
  lastLabel: "",
  unsubs: [] as Array<() => void>,

  init(): void {
    this.unsubs.push(
      sharedCounter.subscribe((v) => (this.shared = v)),
      lastInteraction.subscribe((v) => {
        this.lastApp = v?.app ?? null;
        this.lastLogo = v ? logoSvg(v.app, 12) : "";
        this.lastLabel = v ? (FRAMEWORKS[v.app as AppId]?.label ?? v.app) : "";
      }),
    );
  },

  destroy(): void {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  },

  onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  },

  onLog(): void {
    emitActivity(SELF, `says hello from ${meta.label}`);
  },
}));

export const mount = (el: HTMLElement): (() => void) => {
  const root = document.createElement("div");
  root.innerHTML = template.trim();
  el.appendChild(root);
  Alpine.initTree(root);
  return () => {
    if (typeof (Alpine as unknown as { destroyTree?: (el: HTMLElement) => void }).destroyTree === "function") {
      (Alpine as unknown as { destroyTree: (el: HTMLElement) => void }).destroyTree(root);
    }
    root.remove();
  };
};
