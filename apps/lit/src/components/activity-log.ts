import { LitElement, html, nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const MAX_ENTRIES = 30;

/** Cross-framework activity feed (light DOM — see app-root.ts). */
export class MfActivityLog extends LitElement {
  static properties = {
    entries: { type: Array, state: true },
  };

  private entries: ActivityDetail[] = [];

  createRenderRoot(): Element {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(ACTIVITY_EVENT, this.onActivity);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(ACTIVITY_EVENT, this.onActivity);
  }

  private onActivity = (event: Event): void => {
    const detail = (event as CustomEvent<ActivityDetail>).detail;
    this.entries = [detail, ...this.entries].slice(0, MAX_ENTRIES);
  };

  render() {
    return html`
      <section class="rounded-card border border-border bg-surface p-5 shadow-card">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="text-sm font-semibold">Activity log</h2>
          <p class="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
        </div>

        ${this.entries.length === 0
          ? html`<p class="py-6 text-center text-xs text-muted">
              No activity yet — click around inside the widgets.
            </p>`
          : nothing}
        ${this.entries.length > 0
          ? html`<ul class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              ${this.entries.map(
                (entry, index) => html`
                  <li
                    class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg"
                    data-key="${entry.at}-${index}"
                  >
                    <span class="shrink-0">${unsafeSVG(logoSvg(entry.app as AppId, 14))}</span>
                    <span class="font-semibold"
                      >${FRAMEWORKS[entry.app as AppId]?.label ?? entry.app}</span
                    >
                    <span class="truncate text-muted">${entry.message}</span>
                    <span class="ml-auto shrink-0 font-mono text-[11px] text-muted"
                      >${new Date(entry.at).toLocaleTimeString()}</span
                    >
                  </li>
                `,
              )}
            </ul>`
          : nothing}
      </section>
    `;
  }
}

customElements.define("mf-activity-log", MfActivityLog);
