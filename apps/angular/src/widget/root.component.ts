import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
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
import { PING_EVENT, emitActivity, emitPing, PingDetail } from "@mf-all/widget-contract";
import { APPS, APP_IDS, AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, FrameworkMeta, logoSvg } from "@mf-all/ui";

const metaOf = (id: string) =>
  (FRAMEWORKS as unknown as Record<string, { label: string }>)[id];

const SELF = "angular";
const meta = FRAMEWORKS[SELF];

type TabId = "counters" | "ball" | "board" | "chat" | "pulse";

interface Unseen {
  ball: boolean;
  chat: boolean;
  pulse: boolean;
}

interface ChatMessage {
  app: string;
  text: string;
  at: number;
}

/**
 * Widget root component. Angular component styles are compiled into the
 * component bundle (emulated encapsulation), so the widget's CSS travels
 * with its JS to any host page — no global stylesheet dependency.
 * Tokens (CSS custom properties on :root) style it consistently everywhere.
 */
@Component({
  selector: "mf-angular-widget-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
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

    .row-center {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 14px 0;
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

    .chat-name {
      font-size: 11px;
      color: var(--color-muted, #6f6f7a);
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

    .logo-sm {
      display: inline-block;
      width: 14px;
      height: 14px;
    }

    .name {
      color: var(--color-ink, #1a1a1f);
      font-weight: 500;
    }

    .hint {
      font-size: 11px;
      color: var(--color-muted, #6f6f7a);
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
  `,
  template: `
    <div class="wrap" [class.flash]="flash()">
      <div>
        <div class="tabs" role="tablist">
          @for (t of tabs; track t.id) {
            <button
              role="tab"
              [attr.aria-selected]="tab() === t.id ? 'true' : 'false'"
              [attr.data-mf-tab]="t.id"
              class="tab"
              (click)="openTab(t.id)"
            >
              {{ t.label }}
              @if (hasDot(t.id)) {
                <span class="mfw-dot"></span>
              }
            </button>
          }
        </div>

        @if (tab() === 'counters') {
          <div class="mt stack">
            <section>
              <span class="label">Local · signal() · zoneless</span>
              <div class="row">
                <button class="btn" (click)="local.set(local() + 1)">Local +1</button>
                <span class="value">{{ local() }}</span>
              </div>
            </section>

            <section>
              <span class="label">Shared · platform-memoized atom</span>
              <div class="row">
                <button class="btn-accent" (click)="onShared()">Shared +1</button>
                <span class="value">{{ shared() }}</span>
              </div>
            </section>

            <section data-mf-bars>
              <span class="label">Who clicked shared</span>
              <div class="bars">
                @for (id of appIds; track id) {
                  <span
                    class="bar-item"
                    [attr.data-mf-bar]="id"
                    [attr.data-count]="who()[id] ?? 0"
                    [attr.title]="barTitle(id)"
                  >
                    <span class="bar" [style.height]="barHeight(id)"></span>
                    <span class="bar-logo" [innerHTML]="logoFor(id, 10)"></span>
                  </span>
                }
              </div>
            </section>
          </div>
        } @else if (tab() === 'ball') {
          <div class="mt" data-mf-ball-view>
            @if (ballState().holder === SELF) {
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <button
                  class="ball"
                  data-mf-ball
                  title="Pass the ball to another widget"
                  (click)="onPassBall()"
                >
                  {{ ballState().passes }}
                </button>
                <span class="hint">click to pass</span>
              </div>
            } @else if (holderMeta(); as hm) {
              <div class="row-center" data-mf-ball-holder>
                <span class="hint">ball at:</span>
                <span class="logo-sm" [innerHTML]="logoFor(hm.id, 14)"></span>
                <span class="name" style="font-size: 12px">{{ hm.label }}</span>
              </div>
            }
          </div>
        } @else if (tab() === 'board') {
          <div class="mt">
            <span class="label">Shared canvas · 5×5</span>
            <div class="grid" data-mf-board>
              @for (i of cellIndexes; track i) {
                <button
                  [attr.aria-label]="'cell ' + cellKey(i)"
                  [attr.data-mf-grid-cell]="cellKey(i)"
                  [class]="cellCls(i)"
                  (click)="onCell(i)"
                ></button>
              }
            </div>
          </div>
        } @else if (tab() === 'chat') {
          <div class="mt" style="display: flex; flex-direction: column; gap: 8px;">
            <div class="chat-log" data-mf-chat-log>
              @if (messages().length === 0) {
                <span class="hint">no messages yet</span>
              } @else {
                @for (m of messages(); track $index) {
                  <div class="chat-line">
                    <span class="chat-logo" [innerHTML]="logoFor(m.app, 10)"></span>
                    <span class="chat-name">{{ labelOf(m.app) }}</span>
                    <span class="chat-text" data-mf-chat-msg>{{ m.text }}</span>
                  </div>
                }
              }
            </div>
            <div class="row" style="gap: 6px;">
              <input
                class="chat-input"
                data-mf-chat-input
                placeholder="say hi to the mesh…"
                [value]="draft()"
                (input)="onDraftInput($event)"
                (keydown.enter)="onSendSubmit($event)"
              />
              <button class="btn" data-mf-chat-send (click)="onSendSubmit($event)">Send</button>
            </div>
          </div>
        } @else if (tab() === 'pulse') {
          <div class="mt stack">
            <div class="row">
              <button class="btn-accent" data-mf-ping (click)="onPing()">Ping ×8</button>
              <span class="value" data-mf-ping-count>{{ pingsGot() }}</span>
              <span class="hint">got</span>
            </div>

            <div class="row">
              <span class="mood-current" data-mf-mood>{{ currentMood() }}</span>
              @for (m of MOODS; track m) {
                <button class="mood-btn" [attr.data-mf-mood-set]="m" (click)="onMood(m)">
                  {{ m }}
                </button>
              }
            </div>

            <span class="hint" style="display: block" data-mf-identity>{{ identityLabel }}</span>
          </div>
        }
      </div>

      <div class="foot">
        <span class="last">
          last:
          @if (lastApp(); as lastId) {
            <span class="logo" [innerHTML]="logoFor(lastId, 12)"></span>
            <span class="name">{{ labelOf(lastId) }}</span>
          } @else {
            <span>—</span>
          }
        </span>
        <button class="log" (click)="onLog()">log event</button>
      </div>
    </div>
  `,
})
export class RootComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly FRAMEWORKS = FRAMEWORKS;
  readonly MOODS = MOODS;
  readonly SELF = SELF;

  readonly tabs: Array<{ id: TabId; label: string }> = [
    { id: "counters", label: "Counters" },
    { id: "ball", label: "Ball" },
    { id: "board", label: "Board" },
    { id: "chat", label: "Chat" },
    { id: "pulse", label: "Pulse" },
  ];
  readonly appIds: string[] = [...APP_IDS];
  readonly cellIndexes: number[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);
  readonly identityLabel = (() => {
    const here = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    return here === String(APPS[SELF].port)
      ? "running at home"
      : "federated guest on :" + here;
  })();

  readonly local = signal(0);
  readonly tab = signal<TabId>("counters");
  readonly draft = signal("");
  readonly pingsGot = signal(0);
  readonly flash = signal(false);
  readonly unseen = signal<Unseen>({ ball: false, chat: false, pulse: false });

  readonly shared = signal(sharedCounter.get());
  readonly lastApp = signal<string | null>(lastInteraction.get()?.app ?? null);
  readonly who = signal<Record<string, number>>({ ...attribution.get() });
  readonly ballState = signal({ ...ball.get() });
  readonly messages = signal<ChatMessage[]>([...chat.get()]);
  readonly cells = signal<Record<string, boolean>>({ ...grid.get() });
  readonly currentMood = signal(mood.get());

  private prevHolder: string | null = ball.get().holder;
  private seenChatAt: number | null = null;
  private flashTimer: number | undefined;

  constructor() {
    const unsubCounter = sharedCounter.subscribe((value) => this.shared.set(value));
    const unsubLast = lastInteraction.subscribe((value) => this.lastApp.set(value?.app ?? null));
    const unsubWho = attribution.subscribe((value) => this.who.set({ ...value }));
    const unsubBall = ball.subscribe((value) => {
      const arrived = value.holder === SELF && this.prevHolder !== SELF;
      this.prevHolder = value.holder;
      this.ballState.set({ ...value });
      if (arrived && this.tab() !== "ball") {
        this.markUnseen("ball");
      }
    });
    const unsubChat = chat.subscribe((value) => {
      this.messages.set([...value]);
      const lastAt = value.length > 0 ? value[value.length - 1].at : 0;
      if (this.tab() === "chat" || this.seenChatAt === null) {
        this.seenChatAt = lastAt;
      } else if (lastAt > this.seenChatAt) {
        this.markUnseen("chat");
      }
    });
    const unsubGrid = grid.subscribe((value) => this.cells.set({ ...value }));
    const unsubMood = mood.subscribe((value) => this.currentMood.set(value));

    const onPingEvent = (e: Event): void => {
      const detail = (e as CustomEvent<PingDetail>).detail;
      if (detail.app === SELF) return;
      this.pingsGot.update((n) => n + 1);
      this.flash.set(true);
      if (this.tab() !== "pulse") this.markUnseen("pulse");
      window.clearTimeout(this.flashTimer);
      this.flashTimer = window.setTimeout(() => this.flash.set(false), 600);
    };
    window.addEventListener(PING_EVENT, onPingEvent);

    inject(DestroyRef).onDestroy(() => {
      unsubCounter();
      unsubLast();
      unsubWho();
      unsubBall();
      unsubChat();
      unsubGrid();
      unsubMood();
      window.removeEventListener(PING_EVENT, onPingEvent);
      window.clearTimeout(this.flashTimer);
    });
  }

  private markUnseen(which: keyof Unseen): void {
    this.unseen.update((u) => (u[which] ? u : { ...u, [which]: true }));
  }

  openTab(next: TabId): void {
    this.tab.set(next);
    if (next === "ball" || next === "chat" || next === "pulse") {
      this.unseen.update((u) => ({ ...u, [next]: false }));
    }
  }

  hasDot(id: TabId): boolean {
    return id === "ball" || id === "chat" || id === "pulse" ? this.unseen()[id] : false;
  }

  onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  }

  onLog(): void {
    emitActivity(SELF, `says hello from ${meta.label}`);
  }

  onPassBall(): void {
    const targets = APP_IDS.filter((id) => id !== SELF);
    const to = targets[Math.floor(Math.random() * targets.length)];
    passBall(SELF, to);
    emitActivity(SELF, `passed the ball to ${APPS[to as AppId].label}`);
  }

  onDraftInput(e: Event): void {
    this.draft.set((e.target as HTMLInputElement).value);
  }

  onSendSubmit(e: Event): void {
    e.preventDefault();
    this.onSend();
  }

  onSend(): void {
    const text = this.draft().trim();
    if (!text) return;
    sendChat(SELF, text);
    this.draft.set("");
    emitActivity(SELF, "sent a chat message");
  }

  onPing(): void {
    emitPing(SELF);
    emitActivity(SELF, "pinged everyone");
  }

  onMood(m: string): void {
    setMood(SELF, m);
    emitActivity(SELF, `set the mood to ${m}`);
  }

  labelOf(id: string): string {
    return metaOf(id)?.label ?? id;
  }

  barTitle(id: string): string {
    return `${this.labelOf(id)}: ${this.who()[id] ?? 0}`;
  }

  barHeight(id: string): string {
    const max = Math.max(1, ...APP_IDS.map((a) => this.who()[a] ?? 0));
    return `${2 + ((this.who()[id] ?? 0) / max) * 14}px`;
  }

  cellKey(i: number): string {
    return `${Math.floor(i / GRID_SIZE)}-${i % GRID_SIZE}`;
  }

  cellCls(i: number): string {
    return this.cells()[this.cellKey(i)] ? "cell is-on" : "cell";
  }

  onCell(i: number): void {
    toggleCell(Math.floor(i / GRID_SIZE), i % GRID_SIZE);
  }

  holderMeta(): FrameworkMeta | null {
    const holder = this.ballState().holder;
    return holder ? (FRAMEWORKS[holder as AppId] ?? null) : null;
  }

  logoFor(id: string, size = 12): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(logoSvg(id as AppId, size));
  }
}
