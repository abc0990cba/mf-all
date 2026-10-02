import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Atom } from "nanostores";
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
import {
  PING_EVENT,
  emitActivity,
  emitPing,
  type PingDetail,
} from "@mf-all/widget-contract";
import { APPS, APP_IDS, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
import "./widget.css";

const SELF: AppId = "react";
const meta = FRAMEWORKS[SELF];

type TabId = "counters" | "ball" | "board" | "chat" | "pulse";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "counters", label: "Counters" },
  { id: "ball", label: "Ball" },
  { id: "board", label: "Board" },
  { id: "chat", label: "Chat" },
  { id: "pulse", label: "Pulse" },
];

interface Unseen {
  ball: boolean;
  chat: boolean;
  pulse: boolean;
}

function useStore<T>(store: Atom<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

function herePort(): string {
  return window.location.port || (window.location.protocol === "https:" ? "443" : "80");
}

export function Widget() {
  const [local, setLocal] = useState(0);
  const [tab, setTab] = useState<TabId>("counters");
  const [draft, setDraft] = useState("");
  const [pingsGot, setPingsGot] = useState(0);
  const [flash, setFlash] = useState(false);
  const [unseen, setUnseen] = useState<Unseen>({ ball: false, chat: false, pulse: false });

  const shared = useStore(sharedCounter);
  const last = useStore(lastInteraction);
  const who = useStore(attribution);
  const ballState = useStore(ball);
  const messages = useStore(chat);
  const cells = useStore(grid);
  const currentMood = useStore(mood);

  const tabRef = useRef<TabId>(tab);
  const prevHolder = useRef<string | null>(ballState.holder);
  const seenChatAt = useRef<number | null>(null);

  // Ball arrived here while another tab was open → dot on the Ball tab.
  useEffect(() => {
    if (ballState.holder === SELF && prevHolder.current !== SELF && tabRef.current !== "ball") {
      setUnseen((u) => (u.ball ? u : { ...u, ball: true }));
    }
    prevHolder.current = ballState.holder;
  }, [ballState.holder]);

  // New chat message arrived while another tab was open → dot on the Chat tab.
  useEffect(() => {
    const lastAt = messages.length > 0 ? messages[messages.length - 1].at : 0;
    if (tab === "chat" || seenChatAt.current === null) {
      seenChatAt.current = lastAt;
    } else if (lastAt > seenChatAt.current) {
      setUnseen((u) => (u.chat ? u : { ...u, chat: true }));
    }
  }, [messages, tab]);

  // Pings arrive as DOM events — flash the widget and count, regardless of tab.
  useEffect(() => {
    let timer: number | undefined;
    const onPing = (e: Event): void => {
      const detail = (e as CustomEvent<PingDetail>).detail;
      if (detail.app === SELF) return;
      setPingsGot((n) => n + 1);
      setFlash(true);
      if (tabRef.current !== "pulse") setUnseen((u) => (u.pulse ? u : { ...u, pulse: true }));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFlash(false), 600);
    };
    window.addEventListener(PING_EVENT, onPing);
    return () => {
      window.removeEventListener(PING_EVENT, onPing);
      window.clearTimeout(timer);
    };
  }, []);

  function openTab(next: TabId): void {
    tabRef.current = next;
    setTab(next);
    setUnseen((u) => (next === "ball" || next === "chat" || next === "pulse" ? { ...u, [next]: false } : u));
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
    const text = draft.trim();
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

  const maxAttribution = Math.max(1, ...APP_IDS.map((id) => who[id] ?? 0));
  const isHome = herePort() === String(APPS[SELF].port);
  const holderMeta = ballState.holder ? FRAMEWORKS[ballState.holder as AppId] : null;

  return (
    <div className={`flex h-full flex-col justify-between gap-3${flash ? " mfw-flash" : ""}`}>
      <div>
        <div className="mfw-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-mf-tab={t.id}
              className="mfw-tab"
              onClick={() => openTab(t.id)}
            >
              {t.label}
              {unseen[t.id as keyof Unseen] ? <span className="mfw-dot" /> : null}
            </button>
          ))}
        </div>

        {tab === "counters" && (
          <div className="mt-3 space-y-3.5">
            <section>
              <span className="mfw-label">Local · useState()</span>
              <div className="flex items-center gap-2.5">
                <button type="button" className="mfw-btn" onClick={() => setLocal((n) => n + 1)}>
                  Local +1
                </button>
                <span className="mfw-value">{local}</span>
              </div>
            </section>

            <section>
              <span className="mfw-label">Shared · platform-memoized atom</span>
              <div className="flex items-center gap-2.5">
                <button type="button" className="mfw-btn-accent" onClick={onShared}>
                  Shared +1
                </button>
                <span className="mfw-value">{shared}</span>
              </div>
            </section>

            <section data-mf-bars>
              <span className="mfw-label">Who clicked shared</span>
              <div className="mfw-bars">
                {APP_IDS.map((id) => {
                  const count = who[id] ?? 0;
                  return (
                    <span
                      key={id}
                      className="mfw-bar-item"
                      data-mf-bar={id}
                      data-count={count}
                      title={`${FRAMEWORKS[id].label}: ${count}`}
                    >
                      <span className="mfw-bar" style={{ height: `${2 + (count / maxAttribution) * 14}px` }} />
                      <span
                        className="mfw-bar-logo"
                        dangerouslySetInnerHTML={{ __html: logoSvg(id, 10) }}
                      />
                    </span>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {tab === "ball" && (
          <div className="mt-3" data-mf-ball-view>
            {ballState.holder === SELF ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  className="mfw-ball"
                  data-mf-ball
                  title="Pass the ball to another widget"
                  onClick={onPassBall}
                >
                  {ballState.passes}
                </button>
                <span className="mfw-foot">click to pass</span>
              </div>
            ) : (
              holderMeta && (
                <div className="flex items-center justify-center gap-1.5 py-3.5" data-mf-ball-holder>
                  <span className="mfw-foot">ball at:</span>
                  <span
                    className="inline-block [&>svg]:h-3.5 [&>svg]:w-3.5"
                    dangerouslySetInnerHTML={{ __html: logoSvg(holderMeta.id, 14) }}
                  />
                  <span className="text-xs font-medium text-ink">{holderMeta.label}</span>
                </div>
              )
            )}
          </div>
        )}

        {tab === "board" && (
          <div className="mt-3">
            <span className="mfw-label">Shared canvas · 5×5</span>
            <div className="mfw-grid" data-mf-board>
              {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
                const r = Math.floor(i / GRID_SIZE);
                const c = i % GRID_SIZE;
                const key = `${r}-${c}`;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`cell ${key}`}
                    data-mf-grid-cell={key}
                    className={`mfw-cell${cells[key] ? " is-on" : ""}`}
                    onClick={() => toggleCell(r, c)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {tab === "chat" && (
          <div className="mt-3 space-y-2">
            <div className="mfw-chat-log" data-mf-chat-log>
              {messages.length === 0 ? (
                <span className="mfw-foot">no messages yet</span>
              ) : (
                messages.map((m, i) => (
                  <div key={`${m.at}-${i}`} className="flex items-baseline gap-1.5">
                    <span
                      className="inline-block [&>svg]:h-2.5 [&>svg]:w-2.5"
                      dangerouslySetInnerHTML={{ __html: logoSvg(m.app as AppId, 10) }}
                    />
                    <span className="mfw-foot shrink-0">{FRAMEWORKS[m.app as AppId]?.label ?? m.app}</span>
                    <span className="truncate text-xs text-ink" data-mf-chat-msg>
                      {m.text}
                    </span>
                  </div>
                ))
              )}
            </div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                onSend();
              }}
            >
              <input
                className="mfw-chat-input"
                data-mf-chat-input
                value={draft}
                placeholder="say hi to the mesh…"
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="mfw-btn" data-mf-chat-send>
                Send
              </button>
            </form>
          </div>
        )}

        {tab === "pulse" && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <button type="button" className="mfw-btn-accent" data-mf-ping onClick={onPing}>
                Ping ×8
              </button>
              <span className="mfw-value" data-mf-ping-count>
                {pingsGot}
              </span>
              <span className="mfw-foot">got</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-lg" data-mf-mood>
                {currentMood}
              </span>
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="mfw-mood-btn"
                  data-mf-mood-set={m}
                  onClick={() => onMood(m)}
                >
                  {m}
                </button>
              ))}
            </div>

            <span className="mfw-foot block" data-mf-identity>
              {isHome ? "running at home" : `federated guest on :${herePort()}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="mfw-foot flex items-center gap-1.5">
          last:
          {last ? (
            <>
              <span
                className="inline-block [&>svg]:h-3 [&>svg]:w-3"
                dangerouslySetInnerHTML={{ __html: logoSvg(last.app as AppId, 12) }}
              />
              <span className="font-medium text-ink">{FRAMEWORKS[last.app as AppId]?.label}</span>
            </>
          ) : (
            "—"
          )}
        </span>
        <button
          type="button"
          className="mfw-foot underline-offset-2 hover:text-ink hover:underline"
          onClick={onLog}
        >
          log event
        </button>
      </div>
    </div>
  );
}
