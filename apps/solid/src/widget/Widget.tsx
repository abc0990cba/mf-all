import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
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
import { useStore } from "../lib/store";
import "./widget.css";

const SELF: AppId = "solid";
const meta = FRAMEWORKS[SELF];

type TabId = "counters" | "ball" | "board" | "chat" | "pulse";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "counters", label: "Counters" },
  { id: "ball", label: "Ball" },
  { id: "board", label: "Board" },
  { id: "chat", label: "Chat" },
  { id: "pulse", label: "Pulse" },
];

const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);

export function Widget() {
  const [local, setLocal] = createSignal(0);
  const [tab, setTab] = createSignal<TabId>("counters");
  const [draft, setDraft] = createSignal("");
  const [pingsGot, setPingsGot] = createSignal(0);
  const [flash, setFlash] = createSignal(false);
  const [unseen, setUnseen] = createSignal({ ball: false, chat: false, pulse: false });

  const shared = useStore(sharedCounter);
  const last = useStore(lastInteraction);
  const who = useStore(attribution);
  const ballState = useStore(ball);
  const messages = useStore(chat);
  const cells = useStore(grid);
  const currentMood = useStore(mood);

  let currentTab: TabId = "counters";
  let seenChatAt: number | null = null;
  let prevHolder: string | null = ball.get().holder;

  createEffect(() => {
    const state = ballState();
    const arrived = state.holder === SELF && prevHolder !== SELF;
    prevHolder = state.holder;
    if (arrived && currentTab !== "ball") {
      setUnseen((u) => (u.ball ? u : { ...u, ball: true }));
    }
  });

  createEffect(() => {
    const list = messages();
    const lastAt = list.length > 0 ? list[list.length - 1].at : 0;
    if (currentTab === "chat" || seenChatAt === null) {
      seenChatAt = lastAt;
    } else if (lastAt > seenChatAt) {
      setUnseen((u) => (u.chat ? u : { ...u, chat: true }));
    }
  });

  onMount(() => {
    let flashTimer: number | undefined;
    const onPingEvent = (e: Event): void => {
      const detail = (e as CustomEvent<PingDetail>).detail;
      if (detail.app === SELF) return;
      setPingsGot((n) => n + 1);
      setFlash(true);
      if (currentTab !== "pulse") setUnseen((u) => (u.pulse ? u : { ...u, pulse: true }));
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => setFlash(false), 600);
    };
    window.addEventListener(PING_EVENT, onPingEvent);
    onCleanup(() => window.removeEventListener(PING_EVENT, onPingEvent));
  });

  function openTab(next: TabId): void {
    currentTab = next;
    setTab(next);
    setUnseen((u) =>
      next === "ball" || next === "chat" || next === "pulse" ? { ...u, [next]: false } : u,
    );
  }

  function hasDot(id: TabId): boolean {
    return id === "ball" || id === "chat" || id === "pulse" ? unseen()[id] : false;
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
    const text = draft().trim();
    if (!text) return;
    sendChat(SELF, text);
    setDraft("");
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

  function barHeight(id: string): string {
    const max = Math.max(1, ...APP_IDS.map((a) => who()[a] ?? 0));
    return `${2 + ((who()[id] ?? 0) / max) * 14}px`;
  }

  const maxAttribution = () => Math.max(1, ...APP_IDS.map((a) => who()[a] ?? 0));
  const herePort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  const identityLabel =
    herePort === String(APPS[SELF].port) ? "running at home" : `federated guest on :${herePort}`;

  return (
    <div class={`flex h-full flex-col justify-between gap-3${flash() ? " mfw-flash" : ""}`}>
      <div>
        <div class="mfw-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab() === t.id}
              data-mf-tab={t.id}
              class="mfw-tab"
              onClick={() => openTab(t.id)}
            >
              {t.label}
              {hasDot(t.id) ? <span class="mfw-dot" /> : null}
            </button>
          ))}
        </div>

        <Show when={tab() === "counters"}>
          <div class="mt-3 space-y-3.5">
            <section>
              <span class="mfw-label">Local · createSignal()</span>
              <div class="flex items-center gap-2.5">
                <button type="button" class="mfw-btn" onClick={() => setLocal((n) => n + 1)}>
                  Local +1
                </button>
                <span class="mfw-value">{local()}</span>
              </div>
            </section>

            <section>
              <span class="mfw-label">Shared · platform-memoized atom</span>
              <div class="flex items-center gap-2.5">
                <button type="button" class="mfw-btn-accent" onClick={onShared}>
                  Shared +1
                </button>
                <span class="mfw-value">{shared()}</span>
              </div>
            </section>

            <section data-mf-bars>
              <span class="mfw-label">Who clicked shared</span>
              <div class="mfw-bars">
                {APP_IDS.map((id) => (
                  <span
                    class="mfw-bar-item"
                    data-mf-bar={id}
                    data-count={who()[id] ?? 0}
                    title={`${FRAMEWORKS[id].label}: ${who()[id] ?? 0}`}
                  >
                    <span class="mfw-bar" style={{ height: barHeight(id) }} />
                    <span class="mfw-bar-logo" innerHTML={logoSvg(id, 10)} />
                  </span>
                ))}
              </div>
            </section>
          </div>
        </Show>

        <Show when={tab() === "ball"}>
          <div class="mt-3" data-mf-ball-view>
            <Show
              when={ballState().holder === SELF}
              fallback={
                <Show when={ballState().holder}>
                  {(holder) => (
                    <div class="flex items-center justify-center gap-1.5 py-3.5" data-mf-ball-holder>
                      <span class="mfw-foot">ball at:</span>
                      <span class="inline-block h-3.5 w-3.5" innerHTML={logoSvg(holder() as AppId, 14)} />
                      <span class="text-xs font-medium text-ink">
                        {FRAMEWORKS[holder() as AppId]?.label}
                      </span>
                    </div>
                  )}
                </Show>
              }
            >
              <div class="flex flex-col items-center gap-1">
                <button
                  type="button"
                  class="mfw-ball"
                  data-mf-ball
                  title="Pass the ball to another widget"
                  onClick={onPassBall}
                >
                  {ballState().passes}
                </button>
                <span class="mfw-foot">click to pass</span>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={tab() === "board"}>
          <div class="mt-3">
            <span class="mfw-label">Shared canvas · 5×5</span>
            <div class="mfw-grid" data-mf-board>
              {CELLS.map((i) => (
                <button
                  type="button"
                  aria-label={`cell ${cellKey(i)}`}
                  data-mf-grid-cell={cellKey(i)}
                  class={`mfw-cell${cells()[cellKey(i)] ? " is-on" : ""}`}
                  onClick={() => onCell(i)}
                />
              ))}
            </div>
          </div>
        </Show>

        <Show when={tab() === "chat"}>
          <div class="mt-3 space-y-2">
            <div class="mfw-chat-log" data-mf-chat-log>
              <Show
                when={messages().length > 0}
                fallback={<span class="mfw-foot">no messages yet</span>}
              >
                <For each={messages()}>
                  {(m) => (
                    <div class="flex items-baseline gap-1.5">
                      <span class="inline-block h-2.5 w-2.5" innerHTML={logoSvg(m.app as AppId, 10)} />
                      <span class="mfw-foot shrink-0">
                        {FRAMEWORKS[m.app as AppId]?.label ?? m.app}
                      </span>
                      <span class="truncate text-xs text-ink" data-mf-chat-msg>
                        {m.text}
                      </span>
                    </div>
                  )}
                </For>
              </Show>
            </div>
            <form
              class="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                onSend();
              }}
            >
              <input
                class="mfw-chat-input"
                data-mf-chat-input
                placeholder="say hi to the mesh…"
                value={draft()}
                onInput={(e) => setDraft(e.currentTarget.value)}
              />
              <button type="submit" class="mfw-btn" data-mf-chat-send>
                Send
              </button>
            </form>
          </div>
        </Show>

        <Show when={tab() === "pulse"}>
          <div class="mt-3 space-y-3">
            <div class="flex items-center gap-2.5">
              <button type="button" class="mfw-btn-accent" data-mf-ping onClick={onPing}>
                Ping ×8
              </button>
              <span class="mfw-value" data-mf-ping-count>
                {pingsGot()}
              </span>
              <span class="mfw-foot">got</span>
            </div>

            <div class="flex items-center gap-2.5">
              <span class="text-lg" data-mf-mood>
                {currentMood()}
              </span>
              {MOODS.map((m) => (
                <button
                  type="button"
                  class="mfw-mood-btn"
                  data-mf-mood-set={m}
                  onClick={() => onMood(m)}
                >
                  {m}
                </button>
              ))}
            </div>

            <span class="mfw-foot block" data-mf-identity>
              {identityLabel}
            </span>
          </div>
        </Show>
      </div>

      <div class="flex items-center justify-between">
        <span class="mfw-foot flex items-center gap-1.5">
          last:
          <Show when={last()} fallback="—">
            {(value) => (
              <>
                <span class="inline-block" innerHTML={logoSvg(value().app as AppId, 12)} />
                <span class="font-medium text-ink">
                  {FRAMEWORKS[value().app as AppId]?.label}
                </span>
              </>
            )}
          </Show>
        </span>
        <button
          type="button"
          class="mfw-foot underline-offset-2 hover:text-ink hover:underline"
          onClick={onLog}
        >
          log event
        </button>
      </div>
    </div>
  );
}
