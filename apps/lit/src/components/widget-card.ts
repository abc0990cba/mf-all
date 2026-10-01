import { LitElement, html, nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import type { WidgetUnmount } from "@mf-all/widget-contract";
import { APPS, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
import { loadWidget } from "../lib/widgets";

/**
 * Federated widget card (light DOM — see app-root.ts). Owns the
 * loading → ready → error lifecycle and the retry control; the actual
 * widget is mounted into an inner container by the remote's mount fn.
 */
export class MfWidgetCard extends LitElement {
  static properties = {
    app: { type: String },
    status: { type: String, state: true },
    errorMessage: { type: String, state: true },
  };

  app: AppId = "vue";
  private status: "loading" | "ready" | "error" = "loading";
  private errorMessage = "";

  private container: HTMLElement | null = null;
  private unmount: WidgetUnmount | null = null;
  private loadId = 0;
  private autoRetried = false;

  createRenderRoot(): Element {
    return this;
  }

  firstUpdated(): void {
    this.container = this.querySelector<HTMLElement>(".mf-container");
    void this.mountWidget();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.loadId += 1;
    this.unmount?.();
    this.unmount = null;
  }

  private async mountWidget(): Promise<void> {
    this.loadId += 1;
    const currentLoad = this.loadId;

    // Tear down any previous instance, then retry from a clean container.
    this.unmount?.();
    this.unmount = null;
    if (this.container) this.container.innerHTML = "";
    this.status = "loading";
    this.errorMessage = "";

    const cfg = APPS[this.app];
    try {
      const widget = await loadWidget(this.app);
      if (currentLoad !== this.loadId || !this.container) return;

      const result = widget.mount(this.container);
      if (result instanceof Promise) {
        const dispose = await result;
        if (currentLoad !== this.loadId) {
          dispose();
          return;
        }
        this.unmount = dispose;
      } else {
        this.unmount = result;
      }
      this.status = "ready";
    } catch (error) {
      if (currentLoad !== this.loadId) return;
      console.error(`[mf] failed to load ${cfg.mfName}/widget`, error);
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.status = "error";
      // Self-heal transient cold-start failures with one automatic retry.
      if (!this.autoRetried) {
        this.autoRetried = true;
        setTimeout(() => {
          if (currentLoad === this.loadId && this.status === "error") {
            void this.mountWidget();
          }
        }, 2500);
      }
    } finally {
      // Watchdog: a hung remote load (promise never settles) gets the same
      // single automatic remount.
      setTimeout(() => {
        if (currentLoad === this.loadId && this.status === "loading") {
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
          void this.mountWidget();
        }
      }, 12000);
    }
  }

  render() {
    const cfg = APPS[this.app];
    const meta = FRAMEWORKS[this.app];

    return html`
      <article
        class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card"
      >
        <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span class="shrink-0">${unsafeSVG(logoSvg(this.app, 18))}</span>
          <span class="text-sm font-semibold">${meta.label}</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style="background-color: ${meta.color}1a; color: ${meta.color}"
            >${cfg.mfName}</span
          >
          <span class="ml-auto flex items-center gap-2">
            <span class="font-mono text-[11px] text-muted">:${cfg.port}</span>
            <span
              class="h-1.5 w-1.5 rounded-full ${this.status === "loading"
                ? "animate-pulse bg-amber-400"
                : this.status === "ready"
                  ? "bg-ok"
                  : "bg-err"}"
            ></span>
          </span>
        </header>

        <div class="relative flex-1 p-4">
          ${this.status === "loading"
            ? html`<div class="animate-pulse space-y-3">
                <div class="h-8 w-28 rounded-lg bg-border/70"></div>
                <div class="h-4 w-44 rounded bg-border/50"></div>
                <div class="h-8 w-32 rounded-lg bg-border/70"></div>
                <div class="h-4 w-40 rounded bg-border/50"></div>
              </div>`
            : nothing}
          ${this.status === "error"
            ? html`<div
                class="flex h-full flex-col items-center justify-center gap-2 py-6 text-center"
              >
                <p class="text-xs font-medium text-err">
                  Couldn't load <span class="font-mono">${cfg.mfName}/widget</span>
                </p>
                <p class="text-[11px] text-muted">
                  Is the remote dev server on :${cfg.port} running?
                </p>
                ${this.errorMessage
                  ? html`<p
                      class="mt-1 max-h-16 max-w-full overflow-hidden rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted"
                    >
                      ${this.errorMessage}
                    </p>`
                  : nothing}
                <button
                  class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
                  @click=${() => void this.mountWidget()}
                >
                  Retry
                </button>
              </div>`
            : nothing}

          <div class="mf-container min-h-[120px]"></div>
        </div>
      </article>
    `;
  }
}

customElements.define("mf-widget-card", MfWidgetCard);
