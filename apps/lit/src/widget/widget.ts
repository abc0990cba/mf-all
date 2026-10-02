import { LitElement, css, html, nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";
import { APPS, APP_IDS } from "@mf-all/app-registry";
import {
  GRID_SIZE,
  MOODS,
  attribution,
  ball,
  chat,
  grid,
  incrementShared,
  lastInteraction,
  mood,
  passBall,
  sendChat,
  setMood,
  sharedCounter,
  toggleCell,
} from "@mf-all/shared-store";
import { PING_EVENT, emitActivity, emitPing, type PingDetail } from "@mf-all/widget-contract";

const SELF: AppId = "lit";

type TabId = "counters" | "ball" | "board" | "chat" | "pulse";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "counters", label: "Counters" },
  { id: "ball", label: "Ball" },
  { id: "board", label: "Board" },
  { id: "chat", label: "Chat" },
  { id: "pulse", label: "Pulse" },
];

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
    tab: { type: String, state: true },
    local: { type: Number, state: true },
    shared: { type: Number, state: true },
    lastApp: { type: String, state: true },
    who: { type: Object, state: true },
    ballState: { type: Object, state: true },
    messages: { type: Array, state: true },
    cells: { type: Object, state: true },
    currentMood: { type: String, state: true },
    draft: { type: String, state: true },
    pingsGot: { type: Number, state: true },
    flash: { type: Boolean, state: true },
    unseenBall: { type: Boolean, state: true },
    unseenChat: { type: Boolean, state: true },
    unseenPulse: { type: Boolean, state: true },
  };

  private tab: TabId = "counters";
  private local = 0;
  private shared = sharedCounter.get();
  private lastApp: string | null = lastInteraction.get()?.app ?? null;
  private who: Record<string, number> = attribution.get();
  private ballState = ball.get();
  private messages = chat.get();
  private cells: Record<string, boolean> = grid.get();
  private currentMood = mood.get();
  private draft = "";
  private pingsGot = 0;
  private flash = false;
  private unseenBall = false;
  private unseenChat = false;
  private unseenPulse = false;

  private prevHolder: string | null = this.ballState.holder;
  private seenChatAt: number | null = null;
  private flashTimer: number | undefined;
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
      gap: 0.75rem;
    }

    .flash {
      animation: mfw-flash 0.6s ease-out;
    }

    @keyframes mfw-flash {
      0% {
        outline: 2px solid var(--color-accent, #4f46e5);
        outline-offset: 3px;
      }
      100% {
        outline: 2px solid transparent;
        outline-offset: 3px;
      }
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

    .mt {
      margin-top: 12px;
    }

    .stack > * + * {
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

    .tabs {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .tab {
      position: relative;
      display: inline-flex;
      height: 24px;
      align-items: center;
      border-radius: 6px;
      padding: 0 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-muted, #6f6f7a);
      background: none;
      transition: color 0.15s;
    }

    .tab:hover {
      color: var(--color-ink, #1a1a1f);
    }

    .tab[aria-selected="true"] {
      background: var(--color-accent-soft, #eef0fe);
      color: var(--color-ink, #1a1a1f);
    }

    .mfw-dot {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--color-accent, #4f46e5);
    }

    .ball {
      display: flex;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 999px;
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 14px;
      font-weight: 700;
      color: var(--color-accent-ink, #fff);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      background: radial-gradient(
        circle at 30% 30%,
        color-mix(in srgb, var(--color-accent, #4f46e5) 55%, white),
        var(--color-accent, #4f46e5) 62%,
        color-mix(in srgb, var(--color-accent, #4f46e5) 70%, black)
      );
      transition: transform 0.15s;
    }

    .ball:hover {
      transform: scale(1.05);
    }

    .ball:active {
      transform: scale(0.95);
    }

    .grid {
      display: grid;
      width: fit-content;
      grid-template-columns: repeat(5, 14px);
      gap: 4px;
    }

    .cell {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid var(--color-border, #e6e6ea);
      background: var(--color-surface, #fff);
      padding: 0;
      transition:
        background-color 0.15s,
        border-color 0.15s;
    }

    .cell.is-on {
      border-color: var(--color-accent, #4f46e5);
      background: var(--color-accent, #4f46e5);
    }

    .chat-log {
      display: flex;
      min-height: 52px;
      flex-direction: column;
      justify-content: flex-end;
      gap: 4px;
    }

    .chat-line {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 12px;
    }

    .chat-logo {
      display: inline-block;
      width: 10px;
      height: 10px;
      flex: none;
    }

    .chat-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-ink, #1a1a1f);
    }

    .chat-input {
      flex: 1;
      min-width: 0;
      height: 28px;
      border-radius: 8px;
      border: 1px solid var(--color-border, #e6e6ea);
      background: var(--color-surface, #fff);
      color: var(--color-ink, #1a1a1f);
      padding: 0 8px;
      font-size: 12px;
    }

    .chat-input:focus {
      outline: none;
      box-shadow: 0 0 0 1px var(--color-accent, #4f46e5);
    }

    .mood-btn {
      display: inline-flex;
      width: 32px;
      height: 28px;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: 1px solid var(--color-border, #e6e6ea);
      background: var(--color-surface, #fff);
      font-size: 14px;
    }

    .mood-btn:hover {
      background: var(--color-accent-soft, #eef0fe);
    }

    .mood-current {
      font-size: 18px;
      line-height: 1;
    }

    .bars {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }

    .bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .bar {
      width: 8px;
      min-height: 2px;
      border-radius: 2px 2px 0 0;
      background: var(--color-accent, #4f46e5);
    }

    .bar-logo {
      display: inline-block;
      width: 10px;
      height: 10px;
      opacity: 0.7;
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
      sharedCounter.subscribe((value) => (this.shared = value)),
      lastInteraction.subscribe((value) => (this.lastApp = value?.app ?? null)),
      attribution.subscribe((value) => (this.who = { ...value })),
      ball.subscribe((value) => {
        const arrived = value.holder === SELF && this.prevHolder !== SELF;
        this.prevHolder = value.holder;
        this.ballState = { ...value };
        if (arrived && this.tab !== "ball") this.unseenBall = true;
      }),
      chat.subscribe((value) => {
        this.messages = [...value];
        const lastAt = value.length > 0 ? value[value.length - 1].at : 0;
        if (this.tab === "chat" || this.seenChatAt === null) {
          this.seenChatAt = lastAt;
        } else if (lastAt > this.seenChatAt) {
          this.unseenChat = true;
        }
      }),
      grid.subscribe((value) => (this.cells = { ...value })),
      mood.subscribe((value) => (this.currentMood = value)),
    ];
    window.addEventListener(PING_EVENT, this.onPingEvent);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    window.removeEventListener(PING_EVENT, this.onPingEvent);
    window.clearTimeout(this.flashTimer);
  }

  private readonly onPingEvent = (e: Event): void => {
    const detail = (e as CustomEvent<PingDetail>).detail;
    if (detail.app === SELF) return;
    this.pingsGot += 1;
    this.flash = true;
    if (this.tab !== "pulse") this.unseenPulse = true;
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.flash = false), 600);
  };

  private openTab(next: TabId): void {
    this.tab = next;
    if (next === "ball") this.unseenBall = false;
    if (next === "chat") this.unseenChat = false;
    if (next === "pulse") this.unseenPulse = false;
  }

  private hasDot(id: TabId): boolean {
    if (id === "ball") return this.unseenBall;
    if (id === "chat") return this.unseenChat;
    if (id === "pulse") return this.unseenPulse;
    return false;
  }

  private onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  }

  private onLog(): void {
    emitActivity(SELF, `says hello from ${FRAMEWORKS[SELF].label}`);
  }

  private onPassBall(): void {
    const targets = APP_IDS.filter((id) => id !== SELF);
    const to = targets[Math.floor(Math.random() * targets.length)];
    passBall(SELF, to);
    emitActivity(SELF, `passed the ball to ${APPS[to].label}`);
  }

  private onSend(): void {
    const text = this.draft.trim();
    if (!text) return;
    sendChat(SELF, text);
    this.draft = "";
    emitActivity(SELF, "sent a chat message");
  }

  private onPing(): void {
    emitPing(SELF);
    emitActivity(SELF, "pinged everyone");
  }

  private onMood(m: string): void {
    setMood(SELF, m);
    emitActivity(SELF, `set the mood to ${m}`);
  }

  private cellKey(i: number): string {
    return `${Math.floor(i / GRID_SIZE)}-${i % GRID_SIZE}`;
  }

  private barHeight(id: string): string {
    const max = Math.max(1, ...APP_IDS.map((a) => this.who[a] ?? 0));
    return `${2 + ((this.who[id] ?? 0) / max) * 14}px`;
  }

  render() {
    const lastMeta = this.lastApp ? FRAMEWORKS[this.lastApp as AppId] : null;
    const holderMeta = this.ballState.holder
      ? FRAMEWORKS[this.ballState.holder as AppId]
      : null;
    const maxAttribution = Math.max(1, ...APP_IDS.map((a) => this.who[a] ?? 0));
    const herePort =
      window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    const identityLabel =
      herePort === String(APPS[SELF].port) ? "running at home" : `federated guest on :${herePort}`;

    return html`
      <div class="wrap ${this.flash ? "flash" : nothing}">
        <div>
          <div class="tabs" role="tablist">
            ${TABS.map(
              (t) => html`
                <button
                  role="tab"
                  aria-selected=${this.tab === t.id ? "true" : "false"}
                  data-mf-tab=${t.id}
                  class="tab"
                  @click=${() => this.openTab(t.id)}
                >
                  ${t.label}${this.hasDot(t.id) ? html`<span class="mfw-dot"></span>` : nothing}
                </button>
              `,
            )}
          </div>

          ${this.tab === "counters"
            ? html`
                <div class="mt stack">
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

                  <section data-mf-bars>
                    <span class="label">Who clicked shared</span>
                    <div class="bars">
                      ${APP_IDS.map(
                        (id) => html`
                          <span
                            class="bar-item"
                            data-mf-bar=${id}
                            data-count=${this.who[id] ?? 0}
                            title=${`${FRAMEWORKS[id].label}: ${this.who[id] ?? 0}`}
                          >
                            <span class="bar" style=${`height: ${2 + ((this.who[id] ?? 0) / maxAttribution) * 14}px`}></span>
                            <span class="bar-logo">${unsafeSVG(logoSvg(id, 10))}</span>
                          </span>
                        `,
                      )}
                    </div>
                  </section>
                </div>
              `
            : nothing}

          ${this.tab === "ball"
            ? html`
                <div class="mt" data-mf-ball-view>
                  ${this.ballState.holder === SELF
                    ? html`
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                          <button
                            class="ball"
                            data-mf-ball
                            title="Pass the ball to another widget"
                            @click=${this.onPassBall}
                          >
                            ${this.ballState.passes}
                          </button>
                          <span class="label" style="margin-bottom: 0">click to pass</span>
                        </div>
                      `
                    : holderMeta
                      ? html`
                          <div
                            class="row"
                            style="justify-content: center; padding: 14px 0;"
                            data-mf-ball-holder
                          >
                            <span class="label" style="margin-bottom: 0">ball at:</span>
                            <span class="logo">${unsafeSVG(logoSvg(holderMeta.id, 14))}</span>
                            <span style="font-size: 12px; font-weight: 500"
                              >${holderMeta.label}</span
                            >
                          </div>
                        `
                      : nothing}
                </div>
              `
            : nothing}

          ${this.tab === "board"
            ? html`
                <div class="mt">
                  <span class="label">Shared canvas · 5×5</span>
                  <div class="grid" data-mf-board>
                    ${Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
                      const key = this.cellKey(i);
                      return html`
                        <button
                          aria-label=${`cell ${key}`}
                          data-mf-grid-cell=${key}
                          class=${this.cells[key] ? "cell is-on" : "cell"}
                          @click=${() =>
                            toggleCell(Math.floor(i / GRID_SIZE), i % GRID_SIZE)}
                        ></button>
                      `;
                    })}
                  </div>
                </div>
              `
            : nothing}

          ${this.tab === "chat"
            ? html`
                <div class="mt" style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="chat-log" data-mf-chat-log>
                    ${this.messages.length === 0
                      ? html`<span class="label" style="margin-bottom: 0">no messages yet</span>`
                      : this.messages.map(
                          (m) => html`
                            <div class="chat-line">
                              <span class="chat-logo"
                                >${unsafeSVG(logoSvg(m.app as AppId, 10))}</span
                              >
                              <span class="label" style="margin-bottom: 0"
                                >${FRAMEWORKS[m.app as AppId]?.label ?? m.app}</span
                              >
                              <span class="chat-text" data-mf-chat-msg>${m.text}</span>
                            </div>
                          `,
                        )}
                  </div>
                  <div class="row" style="gap: 6px;">
                    <input
                      class="chat-input"
                      data-mf-chat-input
                      placeholder="say hi to the mesh…"
                      .value=${this.draft}
                      @input=${(e: InputEvent) =>
                        (this.draft = (e.target as HTMLInputElement).value)}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === "Enter") this.onSend();
                      }}
                    />
                    <button class="btn" data-mf-chat-send @click=${this.onSend}>Send</button>
                  </div>
                </div>
              `
            : nothing}

          ${this.tab === "pulse"
            ? html`
                <div class="mt stack">
                  <div class="row">
                    <button class="btn-accent" data-mf-ping @click=${this.onPing}>Ping ×8</button>
                    <span class="value" data-mf-ping-count>${this.pingsGot}</span>
                    <span class="label" style="margin-bottom: 0">got</span>
                  </div>

                  <div class="row">
                    <span class="mood-current" data-mf-mood>${this.currentMood}</span>
                    ${MOODS.map(
                      (m) => html`
                        <button class="mood-btn" data-mf-mood-set=${m} @click=${() => this.onMood(m)}>
                          ${m}
                        </button>
                      `,
                    )}
                  </div>

                  <span class="label" style="margin-bottom: 0" data-mf-identity
                    >${identityLabel}</span
                  >
                </div>
              `
            : nothing}
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
