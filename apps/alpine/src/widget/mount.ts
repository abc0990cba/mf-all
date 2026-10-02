import Alpine from "alpinejs";
import "./widget.css";
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
import { APPS, APP_IDS, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";

const SELF: AppId = "alpine";
const meta = FRAMEWORKS[SELF];

type TabId = "counters" | "ball" | "board" | "chat" | "pulse";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * Alpine is HTML-first: the widget is a declarative markup fragment driven
 * by an `Alpine.data` component. `Alpine.initTree(root)` activates the
 * directives inside the injected subtree — without calling `Alpine.start()`,
 * so the widget copy never scans or claims the host page's DOM.
 * Alpine auto-disposes an element's effects when it leaves the DOM; the
 * guarded `destroyTree` call (Alpine 3.14+) just makes that explicit.
 *
 * NOTE: the template lives in a JS template literal, so Alpine expressions
 * inside it must not use backticks — string concat and helper methods only.
 */
const template = `
  <div class="flex h-full flex-col justify-between gap-3" :class="flash ? 'mfw-flash' : ''" x-data="mfAlpineWidget">
    <div>
      <div class="mfw-tabs" role="tablist">
        <template x-for="t in tabs" :key="t.id">
          <button
            type="button"
            role="tab"
            :aria-selected="tab === t.id ? 'true' : 'false'"
            :data-mf-tab="t.id"
            class="mfw-tab"
            @click="openTab(t.id)"
          >
            <span x-text="t.label"></span>
            <span class="mfw-dot" x-show="hasDot(t.id)"></span>
          </button>
        </template>
      </div>

      <template x-if="tab === 'counters'">
        <div class="mt-3 space-y-3.5">
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

          <section data-mf-bars>
            <span class="mfw-label">Who clicked shared</span>
            <div class="mfw-bars">
              <template x-for="id in appIds" :key="id">
                <span class="mfw-bar-item" :data-mf-bar="id" :data-count="who[id] ?? 0" :title="barTitle(id)">
                  <span class="mfw-bar" :style="{ height: barHeight(id) }"></span>
                  <span class="mfw-bar-logo" x-html="logoOf(id, 10)"></span>
                </span>
              </template>
            </div>
          </section>
        </div>
      </template>

      <template x-if="tab === 'ball'">
        <div class="mt-3" data-mf-ball-view>
          <template x-if="ball.holder === self">
            <div class="flex flex-col items-center gap-1">
              <button
                type="button"
                class="mfw-ball"
                data-mf-ball
                title="Pass the ball to another widget"
                @click="onPassBall()"
                x-text="ball.passes"
              ></button>
              <span class="mfw-foot">click to pass</span>
            </div>
          </template>
          <template x-if="ball.holder !== self">
            <div class="flex items-center justify-center gap-1.5 py-3.5" data-mf-ball-holder>
              <span class="mfw-foot">ball at:</span>
              <span class="inline-block h-3.5 w-3.5" x-html="holderLogo"></span>
              <span class="text-xs font-medium text-ink" x-text="holderLabel"></span>
            </div>
          </template>
        </div>
      </template>

      <template x-if="tab === 'board'">
        <div class="mt-3">
          <span class="mfw-label">Shared canvas · 5×5</span>
          <div class="mfw-grid" data-mf-board>
            <template x-for="i in cellIndexes" :key="i">
              <button
                type="button"
                :aria-label="'cell ' + cellKey(i)"
                :data-mf-grid-cell="cellKey(i)"
                :class="cellCls(i)"
                @click="onCell(i)"
              ></button>
            </template>
          </div>
        </div>
      </template>

      <template x-if="tab === 'chat'">
        <div class="mt-3 space-y-2">
          <div class="mfw-chat-log" data-mf-chat-log>
            <span class="mfw-foot" x-show="messages.length === 0">no messages yet</span>
            <template x-for="(m, i) in messages" :key="m.at + '-' + i">
              <div class="flex items-baseline gap-1.5">
                <span class="inline-block h-2.5 w-2.5" x-html="logoOf(m.app, 10)"></span>
                <span class="mfw-foot shrink-0" x-text="labelOf(m.app)"></span>
                <span class="truncate text-xs text-ink" data-mf-chat-msg x-text="m.text"></span>
              </div>
            </template>
          </div>
          <form class="flex items-center gap-1.5" @submit.prevent="onSend()">
            <input
              class="mfw-chat-input"
              data-mf-chat-input
              placeholder="say hi to the mesh…"
              x-model="draft"
            />
            <button type="submit" class="mfw-btn" data-mf-chat-send>Send</button>
          </form>
        </div>
      </template>

      <template x-if="tab === 'pulse'">
        <div class="mt-3 space-y-3">
          <div class="flex items-center gap-2.5">
            <button type="button" class="mfw-btn-accent" data-mf-ping @click="onPing()">Ping ×8</button>
            <span class="mfw-value" data-mf-ping-count x-text="pingsGot"></span>
            <span class="mfw-foot">got</span>
          </div>

          <div class="flex items-center gap-2.5">
            <span class="text-lg" data-mf-mood x-text="currentMood"></span>
            <template x-for="m in moods" :key="m">
              <button type="button" class="mfw-mood-btn" :data-mf-mood-set="m" @click="onMood(m)" x-text="m"></button>
            </template>
          </div>

          <span class="mfw-foot block" data-mf-identity x-text="identity"></span>
        </div>
      </template>
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
  self: SELF as string,
  tabs: [
    { id: "counters", label: "Counters" },
    { id: "ball", label: "Ball" },
    { id: "board", label: "Board" },
    { id: "chat", label: "Chat" },
    { id: "pulse", label: "Pulse" },
  ] as Array<{ id: TabId; label: string }>,
  moods: [...MOODS],
  appIds: [...APP_IDS] as string[],
  cellIndexes: Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i),

  local: 0,
  tab: "counters" as TabId,
  draft: "",
  pingsGot: 0,
  flash: false,
  unseen: { ball: false, chat: false, pulse: false } as Record<string, boolean>,

  shared: sharedCounter.get(),
  lastApp: null as string | null,
  lastLogo: "",
  lastLabel: "",
  who: { ...attribution.get() } as Record<string, number>,
  ball: { ...ball.get() },
  holderLogo: "",
  holderLabel: "",
  messages: [...chat.get()],
  cells: { ...grid.get() } as Record<string, boolean>,
  currentMood: mood.get(),
  identity: (() => {
    const here = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    return here === String(APPS[SELF].port)
      ? "running at home"
      : "federated guest on :" + here;
  })(),

  seenChatAt: null as number | null,
  prevHolder: ball.get().holder,
  flashTimer: undefined as number | undefined,
  unsubs: [] as Array<() => void>,
  pingHandler: null as ((e: Event) => void) | null,

  init(): void {
    // Bound wrapper: the raw method reference would lose `this` when the
    // window event fires.
    this.pingHandler = (e: Event) => this.onPingEvent(e);
    this.unsubs.push(
      sharedCounter.subscribe((v: number) => (this.shared = v)),
      lastInteraction.subscribe((v: { app: string } | null) => {
        this.lastApp = v?.app ?? null;
        this.lastLogo = v ? logoSvg(v.app as AppId, 12) : "";
        this.lastLabel = v ? (FRAMEWORKS[v.app as AppId]?.label ?? v.app) : "";
      }),
      attribution.subscribe((v: Record<string, number>) => (this.who = { ...v })),
      ball.subscribe((v: { holder: string | null; passes: number }) => {
        const arrived = v.holder === SELF && this.prevHolder !== SELF;
        this.prevHolder = v.holder;
        this.ball = { ...v };
        this.holderLogo = v.holder ? logoSvg(v.holder as AppId, 14) : "";
        this.holderLabel = v.holder ? (FRAMEWORKS[v.holder as AppId]?.label ?? v.holder) : "";
        if (arrived && this.tab !== "ball") this.unseen.ball = true;
      }),
      chat.subscribe((v: Array<{ app: string; text: string; at: number }>) => {
        this.messages = [...v];
        const lastAt = v.length > 0 ? v[v.length - 1].at : 0;
        if (this.tab === "chat" || this.seenChatAt === null) {
          this.seenChatAt = lastAt;
        } else if (lastAt > this.seenChatAt) {
          this.unseen.chat = true;
        }
      }),
      grid.subscribe((v: Record<string, boolean>) => (this.cells = { ...v })),
      mood.subscribe((v: string) => (this.currentMood = v)),
    );
    window.addEventListener(PING_EVENT, this.pingHandler);
  },

  destroy(): void {
    if (this.pingHandler) window.removeEventListener(PING_EVENT, this.pingHandler);
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    window.clearTimeout(this.flashTimer);
  },

  onPingEvent(e: Event): void {
    const detail = (e as CustomEvent<PingDetail>).detail;
    if (detail.app === SELF) return;
    this.pingsGot += 1;
    this.flash = true;
    if (this.tab !== "pulse") this.unseen.pulse = true;
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.flash = false), 600);
  },

  openTab(next: TabId): void {
    this.tab = next;
    if (next === "ball" || next === "chat" || next === "pulse") this.unseen[next] = false;
  },

  hasDot(id: TabId): boolean {
    return id === "ball" || id === "chat" || id === "pulse" ? this.unseen[id] : false;
  },

  onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  },

  onLog(): void {
    emitActivity(SELF, `says hello from ${meta.label}`);
  },

  onPassBall(): void {
    const targets = APP_IDS.filter((id) => id !== SELF);
    const to = targets[Math.floor(Math.random() * targets.length)];
    passBall(SELF, to);
    emitActivity(SELF, `passed the ball to ${APPS[to].label}`);
  },

  onSend(): void {
    const text = this.draft.trim();
    if (!text) return;
    sendChat(SELF, text);
    this.draft = "";
    emitActivity(SELF, "sent a chat message");
  },

  onPing(): void {
    emitPing(SELF);
    emitActivity(SELF, "pinged everyone");
  },

  onMood(m: string): void {
    setMood(SELF, m);
    emitActivity(SELF, `set the mood to ${m}`);
  },

  logoOf(id: string, size: number): string {
    return logoSvg(id as AppId, size);
  },

  labelOf(id: string): string {
    return FRAMEWORKS[id as AppId]?.label ?? id;
  },

  barTitle(id: string): string {
    return this.labelOf(id) + ": " + (this.who[id] ?? 0);
  },

  barHeight(id: string): string {
    const max = Math.max(1, ...APP_IDS.map((a) => this.who[a] ?? 0));
    return 2 + ((this.who[id] ?? 0) / max) * 14 + "px";
  },

  cellKey(i: number): string {
    return Math.floor(i / GRID_SIZE) + "-" + (i % GRID_SIZE);
  },

  cellCls(i: number): string {
    return this.cells[this.cellKey(i)] ? "mfw-cell is-on" : "mfw-cell";
  },

  onCell(i: number): void {
    toggleCell(Math.floor(i / GRID_SIZE), i % GRID_SIZE);
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
