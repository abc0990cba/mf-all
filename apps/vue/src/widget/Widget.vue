<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
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

const SELF: AppId = "vue";
const meta = FRAMEWORKS[SELF];

type TabId = "counters" | "ball" | "board" | "chat" | "pulse";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "counters", label: "Counters" },
  { id: "ball", label: "Ball" },
  { id: "board", label: "Board" },
  { id: "chat", label: "Chat" },
  { id: "pulse", label: "Pulse" },
];

const local = ref(0);
const tab = ref<TabId>("counters");
const draft = ref("");
const pingsGot = ref(0);
const flash = ref(false);
const unseen = ref({ ball: false, chat: false, pulse: false });

const shared = ref(sharedCounter.get());
const last = ref(lastInteraction.get());
const who = ref(attribution.get());
const ballState = ref(ball.get());
const messages = ref(chat.get());
const cells = ref(grid.get());
const currentMood = ref(mood.get());

let seenChatAt: number | null = null;
let prevHolder: string | null = ball.get().holder;

const unsubs = [
  sharedCounter.subscribe((v) => (shared.value = v)),
  lastInteraction.subscribe((v) => (last.value = v)),
  attribution.subscribe((v) => (who.value = v)),
  ball.subscribe((v) => {
    const arrived = v.holder === SELF && prevHolder !== SELF;
    prevHolder = v.holder;
    ballState.value = v;
    if (arrived && tab.value !== "ball") unseen.value.ball = true;
  }),
  chat.subscribe((v) => {
    messages.value = v;
    const lastAt = v.length > 0 ? v[v.length - 1].at : 0;
    if (tab.value === "chat" || seenChatAt === null) {
      seenChatAt = lastAt;
    } else if (lastAt > seenChatAt) {
      unseen.value.chat = true;
    }
  }),
  grid.subscribe((v) => (cells.value = v)),
  mood.subscribe((v) => (currentMood.value = v)),
];

let flashTimer: number | undefined;
function onPingEvent(e: Event): void {
  const detail = (e as CustomEvent<PingDetail>).detail;
  if (detail.app === SELF) return;
  pingsGot.value += 1;
  flash.value = true;
  if (tab.value !== "pulse") unseen.value.pulse = true;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (flash.value = false), 600);
}
window.addEventListener(PING_EVENT, onPingEvent);

onScopeDispose(() => {
  unsubs.forEach((unsub) => unsub());
  window.removeEventListener(PING_EVENT, onPingEvent);
  window.clearTimeout(flashTimer);
});

function openTab(next: TabId): void {
  tab.value = next;
  if (next === "ball" || next === "chat" || next === "pulse") unseen.value[next] = false;
}

function hasDot(id: TabId): boolean {
  return id === "ball" || id === "chat" || id === "pulse" ? unseen.value[id] : false;
}

function onShared(): void {
  incrementShared(SELF);
  emitActivity(SELF, "incremented the shared counter");
}

function onLog(): void {
  emitActivity(SELF, `says hello from ${meta.label}`);
}

function onPassBall(): void {
  const targets = APP_IDS.filter((id) => id !== SELF);
  const to = targets[Math.floor(Math.random() * targets.length)];
  passBall(SELF, to);
  emitActivity(SELF, `passed the ball to ${APPS[to].label}`);
}

function onSend(): void {
  const text = draft.value.trim();
  if (!text) return;
  sendChat(SELF, text);
  draft.value = "";
  emitActivity(SELF, "sent a chat message");
}

function onPing(): void {
  emitPing(SELF);
  emitActivity(SELF, "pinged everyone");
}

function onMood(m: string): void {
  setMood(SELF, m);
  emitActivity(SELF, `set the mood to ${m}`);
}

function cellKey(i: number): string {
  return `${Math.floor(i / GRID_SIZE)}-${i % GRID_SIZE}`;
}

function onCell(i: number): void {
  toggleCell(Math.floor(i / GRID_SIZE), i % GRID_SIZE);
}

const holderMeta = computed(() =>
  ballState.value.holder ? FRAMEWORKS[ballState.value.holder as AppId] : null,
);
const maxAttribution = computed(() => Math.max(1, ...APP_IDS.map((id) => who.value[id] ?? 0)));
const herePort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
const isHome = herePort === String(APPS[SELF].port);
const identityLabel = isHome ? "running at home" : `federated guest on :${herePort}`;

const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-3" :class="flash ? 'mfw-flash' : ''">
    <div>
      <div class="mfw-tabs" role="tablist">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          :data-mf-tab="t.id"
          class="mfw-tab"
          @click="openTab(t.id)"
        >
          {{ t.label }}
          <span v-if="hasDot(t.id)" class="mfw-dot" />
        </button>
      </div>

      <div v-if="tab === 'counters'" class="mt-3 space-y-3.5">
        <section>
          <span class="mfw-label">Local · ref()</span>
          <div class="flex items-center gap-2.5">
            <button class="mfw-btn" @click="local++">Local +1</button>
            <span class="mfw-value">{{ local }}</span>
          </div>
        </section>

        <section>
          <span class="mfw-label">Shared · platform-memoized atom</span>
          <div class="flex items-center gap-2.5">
            <button class="mfw-btn-accent" @click="onShared">Shared +1</button>
            <span class="mfw-value">{{ shared }}</span>
          </div>
        </section>

        <section data-mf-bars>
          <span class="mfw-label">Who clicked shared</span>
          <div class="mfw-bars">
            <span
              v-for="id in APP_IDS"
              :key="id"
              class="mfw-bar-item"
              :data-mf-bar="id"
              :data-count="who[id] ?? 0"
              :title="`${FRAMEWORKS[id].label}: ${who[id] ?? 0}`"
            >
              <span class="mfw-bar" :style="{ height: `${2 + ((who[id] ?? 0) / maxAttribution) * 14}px` }" />
              <span class="mfw-bar-logo" v-html="logoSvg(id, 10)" />
            </span>
          </div>
        </section>
      </div>

      <div v-else-if="tab === 'ball'" class="mt-3" data-mf-ball-view>
        <div v-if="ballState.holder === SELF" class="flex flex-col items-center gap-1">
          <button
            type="button"
            class="mfw-ball"
            data-mf-ball
            title="Pass the ball to another widget"
            @click="onPassBall"
          >
            {{ ballState.passes }}
          </button>
          <span class="mfw-foot">click to pass</span>
        </div>
        <div v-else-if="holderMeta" class="flex items-center justify-center gap-1.5 py-3.5" data-mf-ball-holder>
          <span class="mfw-foot">ball at:</span>
          <span class="inline-block h-3.5 w-3.5" v-html="logoSvg(holderMeta.id, 14)" />
          <span class="text-xs font-medium text-ink">{{ holderMeta.label }}</span>
        </div>
      </div>

      <div v-else-if="tab === 'board'" class="mt-3">
        <span class="mfw-label">Shared canvas · 5×5</span>
        <div class="mfw-grid" data-mf-board>
          <button
            v-for="i in CELLS"
            :key="i"
            type="button"
            :aria-label="`cell ${cellKey(i)}`"
            :data-mf-grid-cell="cellKey(i)"
            :class="['mfw-cell', cells[cellKey(i)] ? 'is-on' : '']"
            @click="onCell(i)"
          />
        </div>
      </div>

      <div v-else-if="tab === 'chat'" class="mt-3 space-y-2">
        <div class="mfw-chat-log" data-mf-chat-log>
          <span v-if="messages.length === 0" class="mfw-foot">no messages yet</span>
          <div v-for="(m, i) in messages" :key="`${m.at}-${i}`" class="flex items-baseline gap-1.5">
            <span class="inline-block h-2.5 w-2.5" v-html="logoSvg(m.app as AppId, 10)" />
            <span class="mfw-foot shrink-0">{{ FRAMEWORKS[m.app as AppId]?.label ?? m.app }}</span>
            <span class="truncate text-xs text-ink" data-mf-chat-msg>{{ m.text }}</span>
          </div>
        </div>
        <form class="flex items-center gap-1.5" @submit.prevent="onSend">
          <input
            v-model="draft"
            class="mfw-chat-input"
            data-mf-chat-input
            placeholder="say hi to the mesh…"
          />
          <button type="submit" class="mfw-btn" data-mf-chat-send>Send</button>
        </form>
      </div>

      <div v-else-if="tab === 'pulse'" class="mt-3 space-y-3">
        <div class="flex items-center gap-2.5">
          <button type="button" class="mfw-btn-accent" data-mf-ping @click="onPing">Ping ×8</button>
          <span class="mfw-value" data-mf-ping-count>{{ pingsGot }}</span>
          <span class="mfw-foot">got</span>
        </div>

        <div class="flex items-center gap-2.5">
          <span class="text-lg" data-mf-mood>{{ currentMood }}</span>
          <button
            v-for="m in MOODS"
            :key="m"
            type="button"
            class="mfw-mood-btn"
            :data-mf-mood-set="m"
            @click="onMood(m)"
          >
            {{ m }}
          </button>
        </div>

        <span class="mfw-foot block" data-mf-identity>
          {{ identityLabel }}
        </span>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <span class="mfw-foot flex items-center gap-1.5">
        last:
        <template v-if="last">
          <span class="inline-block h-3 w-3" v-html="logoSvg(last.app as AppId, 12)" />
          <span class="font-medium text-ink">{{ FRAMEWORKS[last.app as AppId]?.label }}</span>
        </template>
        <template v-else>—</template>
      </span>
      <button class="mfw-foot underline-offset-2 hover:text-ink hover:underline" @click="onLog">
        log event
      </button>
    </div>
  </div>
</template>
