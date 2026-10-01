import { LitElement, css, html, nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";
import { incrementShared, lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";

const SELF: AppId = "lit";

/**
 * The Lit widget — a true custom element with full shadow-DOM encapsulation.
 *
 * Tailwind utilities can't cross a shadow root, so this widget styles itself
 * with `static styles` consuming the SAME design tokens (CSS custom
 * properties on :root inherit through the shadow boundary). Identical look,
 * different — and deliberately stronger — isolation model.
 */
export class MfLitWidget extends LitElement {
  static properties = {
    local: { type: Number, state: true },
    shared: { type: Number, state: true },
    lastApp: { type: String, state: true },
  };

  private local = 0;
  private shared = sharedCounter.get();
  private lastApp: string | null = lastInteraction.get()?.app ?? null;
  private unsubs: Array<() => void> = [];

  static styles = css`
    :host {
      display: block;
      color: var(--color-ink, #1a1a1f);
      font-family: var(--font-sans, system-ui, sans-serif);
    }

    .wrap {
      display: flex;
      height: 100%;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
    }

    .label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-muted, #6f6f7a);
    }

    section + section {
      margin-top: 14px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .value {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    button {
      border: none;
      cursor: pointer;
      font: inherit;
    }

    .btn,
    .btn-accent {
      display: inline-flex;
      height: 32px;
      align-items: center;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 500;
      transition:
        background-color 0.15s,
        filter 0.15s;
    }

    .btn {
      border: 1px solid var(--color-border, #e6e6ea);
      background: var(--color-surface, #fff);
      color: var(--color-ink, #1a1a1f);
    }

    .btn:hover {
      background: var(--color-accent-soft, #eef0fe);
    }

    .btn-accent {
      background: var(--color-accent, #4f46e5);
      color: var(--color-accent-ink, #fff);
    }

    .btn-accent:hover {
      filter: brightness(1.08);
    }

    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--color-muted, #6f6f7a);
    }

    .last {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .logo {
      display: inline-block;
      width: 12px;
      height: 12px;
    }

    .log {
      background: none;
      padding: 0;
      color: var(--color-muted, #6f6f7a);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .log:hover {
      color: var(--color-ink, #1a1a1f);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubs = [
      sharedCounter.subscribe((value) => {
        this.shared = value;
      }),
      lastInteraction.subscribe((value) => {
        this.lastApp = value?.app ?? null;
      }),
    ];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  }

  private onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  }

  private onLog(): void {
    emitActivity(SELF, `says hello from ${FRAMEWORKS[SELF].label}`);
  }

  render() {
    const lastMeta = this.lastApp ? FRAMEWORKS[this.lastApp as AppId] : null;

    return html`
      <div class="wrap">
        <div>
          <section>
            <span class="label">Local · reactive properties</span>
            <div class="row">
              <button class="btn" @click=${() => (this.local += 1)}>Local +1</button>
              <span class="value">${this.local}</span>
            </div>
          </section>

          <section>
            <span class="label">Shared · platform-memoized atom</span>
            <div class="row">
              <button class="btn-accent" @click=${this.onShared}>Shared +1</button>
              <span class="value">${this.shared}</span>
            </div>
          </section>
        </div>

        <div class="foot">
          <span class="last">
            last:
            ${lastMeta
              ? html`
                  <span class="logo">${unsafeSVG(logoSvg(lastMeta.id, 12))}</span>
                  <span style="color: var(--color-ink, #1a1a1f); font-weight: 500"
                    >${lastMeta.label}</span
                  >
                `
              : "—"}
          </span>
          <button class="log" @click=${this.onLog}>log event</button>
        </div>
      </div>
      ${nothing}
    `;
  }
}

customElements.define("mf-lit-widget", MfLitWidget);
