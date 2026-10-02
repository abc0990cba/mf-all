import $ from "jquery";
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

const SELF: AppId = "jquery";
const meta = FRAMEWORKS[SELF];

const TABS: Array<{ id: string; label: string }> = [
  { id: "counters", label: "Counters" },
  { id: "ball", label: "Ball" },
  { id: "board", label: "Board" },
  { id: "chat", label: "Chat" },
  { id: "pulse", label: "Pulse" },
];

const GRID_BUTTONS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
  const key = `${Math.floor(i / GRID_SIZE)}-${i % GRID_SIZE}`;
  return `<button type="button" aria-label="cell ${key}" data-mf-grid-cell="${key}" class="mfw-cell"></button>`;
}).join("");

const BAR_ITEMS = APP_IDS.map(
  (id) =>
    `<span class="mfw-bar-item" data-mf-bar="${id}" data-count="0" title="${FRAMEWORKS[id].label}: 0">
      <span class="mfw-bar"></span>
      <span class="mfw-bar-logo">${logoSvg(id, 10)}</span>
    </span>`,
).join("");

const TAB_BUTTONS = TABS.map(
  (t, i) =>
    `<button type="button" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-mf-tab="${t.id}" class="mfw-tab">
      ${t.label}<span class="mfw-dot hidden"></span>
    </button>`,
).join("");

const herePort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
const IDENTITY =
  herePort === String(APPS[SELF].port) ? "running at home" : `federated guest on :${herePort}`;

/**
 * The widget markup. NOTE: no leading whitespace — jQuery 4 only treats a
 * string as HTML when it starts with "<"; leading whitespace makes $()
 * parse it as a selector (returning an empty set).
 *
 * All five tab views stay in the DOM; jQuery toggles their visibility, so
 * the card stays minimalistic while every feature is one click away.
 */
const WIDGET_MARKUP = `<div class="flex h-full flex-col justify-between gap-3" data-mf-root>
  <div>
    <div class="mfw-tabs" role="tablist">${TAB_BUTTONS}</div>

    <div data-mf-view="counters" class="mt-3 space-y-3.5">
      <section>
        <span class="mfw-label">Local · jQuery events</span>
        <div class="flex items-center gap-2.5">
          <button type="button" class="mfw-btn" data-action="local">Local +1</button>
          <span class="mfw-value" data-out="local">0</span>
        </div>
      </section>

      <section>
        <span class="mfw-label">Shared · platform-memoized atom</span>
        <div class="flex items-center gap-2.5">
          <button type="button" class="mfw-btn-accent" data-action="shared">Shared +1</button>
          <span class="mfw-value" data-out="shared">${sharedCounter.get()}</span>
        </div>
      </section>

      <section data-mf-bars>
        <span class="mfw-label">Who clicked shared</span>
        <div class="mfw-bars">${BAR_ITEMS}</div>
      </section>
    </div>

    <div data-mf-view="ball" data-mf-ball-view class="mt-3"></div>

    <div data-mf-view="board" class="mt-3">
      <span class="mfw-label">Shared canvas · 5×5</span>
      <div class="mfw-grid" data-mf-board>${GRID_BUTTONS}</div>
    </div>

    <div data-mf-view="chat" class="mt-3 space-y-2">
      <div class="mfw-chat-log" data-mf-chat-log></div>
      <form class="flex items-center gap-1.5" data-mf-chat-form>
        <input class="mfw-chat-input" data-mf-chat-input placeholder="say hi to the mesh…" />
        <button type="submit" class="mfw-btn" data-mf-chat-send>Send</button>
      </form>
    </div>

    <div data-mf-view="pulse" class="mt-3 space-y-3">
      <div class="flex items-center gap-2.5">
        <button type="button" class="mfw-btn-accent" data-mf-ping>Ping ×8</button>
        <span class="mfw-value" data-mf-ping-count>0</span>
        <span class="mfw-foot">got</span>
      </div>

      <div class="flex items-center gap-2.5">
        <span class="text-lg" data-mf-mood>${mood.get()}</span>
        ${MOODS.map((m) => `<button type="button" class="mfw-mood-btn" data-mf-mood-set="${m}">${m}</button>`).join("")}
      </div>

      <span class="mfw-foot block" data-mf-identity>${IDENTITY}</span>
    </div>
  </div>

  <div class="flex items-center justify-between">
    <span class="mfw-foot flex items-center gap-1.5">
      last:
      <span data-out="last">—</span>
    </span>
    <button
      type="button"
      class="mfw-foot underline-offset-2 hover:text-ink hover:underline"
      data-action="log"
    >
      log event
    </button>
  </div>
</div>`;

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * The jQuery widget is the "legacy remote" of the demo: plain DOM built and
 * wired with jQuery events — no framework runtime, no plugin, no shared
 * deps. All cross-widget handlers are delegated on the widget root (views
 * re-render their inner DOM), chat text is inserted via .text() — never
 * HTML — and teardown unwires everything and removes the node.
 */
export const mount = (el: HTMLElement): (() => void) => {
  let local = 0;
  let tab = "counters";
  let pingsGot = 0;
  let seenChatAt: number | null = null;
  let prevHolder: string | null = ball.get().holder;
  let flashTimer: number | undefined;

  const $root = $(WIDGET_MARKUP);
  $(el).append($root);

  const showView = (next: string): void => {
    tab = next;
    $root.find("[data-mf-view]").each((_, el) => {
      $(el).toggleClass("hidden", $(el).attr("data-mf-view") !== next);
    });
    $root.find("[data-mf-tab]").each((_, el) => {
      $(el).attr("aria-selected", $(el).attr("data-mf-tab") === next ? "true" : "false");
    });
  };

  const clearDot = (name: string): void => {
    $root
      .find(`[data-mf-tab='${name}'] .mfw-dot`)
      .addClass("hidden");
  };

  const openTab = (next: string): void => {
    showView(next);
    if (next === "ball" || next === "chat" || next === "pulse") clearDot(next);
  };

  const renderLast = (): void => {
    const last = lastInteraction.get();
    const $out = $root.find("[data-out='last']");
    if (!last) {
      $out.text("—");
      return;
    }
    $out
      .empty()
      .append(`<span class="inline-block">${logoSvg(last.app, 12)}</span>`)
      .append(`<span class="font-medium text-ink">${FRAMEWORKS[last.app as AppId]?.label}</span>`);
  };

  const renderBars = (): void => {
    const who = attribution.get();
    const max = Math.max(1, ...APP_IDS.map((a) => who[a] ?? 0));
    $root.find("[data-mf-bar]").each((_, el) => {
      const $el = $(el);
      const id = ($el.attr("data-mf-bar") ?? "") as AppId;
      const count = who[id] ?? 0;
      $el.attr("data-count", String(count));
      $el.attr("title", `${FRAMEWORKS[id].label}: ${count}`);
      $el.find(".mfw-bar").css("height", `${2 + (count / max) * 14}px`);
    });
  };

  const renderBall = (): void => {
    const state = ball.get();
    const $view = $root.find("[data-mf-ball-view]");
    $view.empty();
    if (state.holder === SELF) {
      $view.append(
        `<div class="flex flex-col items-center gap-1">
          <button type="button" class="mfw-ball" data-mf-ball title="Pass the ball to another widget">${state.passes}</button>
          <span class="mfw-foot">click to pass</span>
        </div>`,
      );
    } else if (state.holder) {
      const $row = $(
        "<div class='flex items-center justify-center gap-1.5 py-3.5' data-mf-ball-holder></div>",
      );
      $row.append("<span class='mfw-foot'>ball at:</span>");
      $row.append(
        $(logoSvg(state.holder, 14)).addClass("inline-block h-3.5 w-3.5"),
      );
      $row.append(
        $("<span class='text-xs font-medium text-ink'></span>").text(
          FRAMEWORKS[state.holder as AppId]?.label ?? "",
        ),
      );
      $view.append($row);
    }
  };

  const renderChat = (): void => {
    const $log = $root.find("[data-mf-chat-log]");
    $log.empty();
    const messages = chat.get();
    if (messages.length === 0) {
      $log.append($("<span class='mfw-foot'>no messages yet</span>"));
      return;
    }
    messages.forEach((m) => {
      const $line = $("<div class='flex items-baseline gap-1.5'></div>");
      $line.append($(logoSvg(m.app as AppId, 10)).addClass("inline-block h-2.5 w-2.5"));
      $line.append(
        $("<span class='mfw-foot shrink-0'></span>").text(
          FRAMEWORKS[m.app as AppId]?.label ?? m.app,
        ),
      );
      // .text(), never .html(): chat text comes from other widgets' users.
      $line.append(
        $("<span class='truncate text-xs text-ink' data-mf-chat-msg></span>").text(m.text),
      );
      $log.append($line);
    });
  };

  const renderCells = (): void => {
    const cells = grid.get();
    $root.find("[data-mf-grid-cell]").each((_, el) => {
      const $el = $(el);
      $el.toggleClass("is-on", !!cells[$el.attr("data-mf-grid-cell") ?? ""]);
    });
  };

  const renderMood = (): void => {
    $root.find("[data-mf-mood]").text(mood.get());
  };

  const onLocal = (): void => {
    local += 1;
    $root.find("[data-out='local']").text(String(local));
  };

  const onShared = (): void => {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  };

  const onLog = (): void => {
    emitActivity(SELF, `says hello from ${meta.label}`);
  };

  const onPassBall = (): void => {
    const targets = APP_IDS.filter((id) => id !== SELF);
    const to = targets[Math.floor(Math.random() * targets.length)];
    passBall(SELF, to);
    emitActivity(SELF, `passed the ball to ${APPS[to].label}`);
  };

  const onSend = (): void => {
    const $input = $root.find("[data-mf-chat-input]");
    const text = String($input.val() ?? "").trim();
    if (!text) return;
    sendChat(SELF, text);
    $input.val("");
    emitActivity(SELF, "sent a chat message");
  };

  const onPing = (): void => {
    emitPing(SELF);
    emitActivity(SELF, "pinged everyone");
  };

  const onMoodSet = (e: JQuery.TriggeredEvent): void => {
    const m = $(e.currentTarget).attr("data-mf-mood-set") ?? "";
    setMood(SELF, m);
    emitActivity(SELF, `set the mood to ${m}`);
  };

  const onCell = (e: JQuery.TriggeredEvent): void => {
    const [r, c] = ($(e.currentTarget).attr("data-mf-grid-cell") ?? "0-0").split("-").map(Number);
    toggleCell(r, c);
  };

  const onPingEvent = (e: Event): void => {
    const detail = (e as CustomEvent<PingDetail>).detail;
    if (detail.app === SELF) return;
    pingsGot += 1;
    $root.find("[data-mf-ping-count]").text(String(pingsGot));
    $root.find("[data-mf-root]").addClass("mfw-flash");
    if (tab !== "pulse") {
      $root.find("[data-mf-tab='pulse'] .mfw-dot").removeClass("hidden");
    }
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(
      () => $root.find("[data-mf-root]").removeClass("mfw-flash"),
      600,
    );
  };

  const onStoreBall = (): void => {
    const state = ball.get();
    const arrived = state.holder === SELF && prevHolder !== SELF;
    prevHolder = state.holder;
    renderBall();
    if (arrived && tab !== "ball") {
      $root.find("[data-mf-tab='ball'] .mfw-dot").removeClass("hidden");
    }
  };

  const onStoreChat = (): void => {
    const messages = chat.get();
    const lastAt = messages.length > 0 ? messages[messages.length - 1].at : 0;
    renderChat();
    if (tab === "chat" || seenChatAt === null) {
      seenChatAt = lastAt;
    } else if (lastAt > seenChatAt) {
      $root.find("[data-mf-tab='chat'] .mfw-dot").removeClass("hidden");
    }
  };

  // Delegated handlers — survive the ball view re-rendering its inner DOM.
  $root.on("click", "[data-action='local']", onLocal);
  $root.on("click", "[data-action='shared']", onShared);
  $root.on("click", "[data-action='log']", onLog);
  $root.on("click", "[data-mf-tab]", function (this: HTMLElement) {
    openTab($(this).attr("data-mf-tab") ?? "counters");
  });
  $root.on("click", "[data-mf-ball]", onPassBall);
  $root.on("click", "[data-mf-ping]", onPing);
  $root.on("click", "[data-mf-mood-set]", onMoodSet);
  $root.on("click", "[data-mf-grid-cell]", onCell);
  $root.on("submit", "[data-mf-chat-form]", (e) => {
    e.preventDefault();
    onSend();
  });

  const unsubs = [
    sharedCounter.subscribe(() =>
      $root.find("[data-out='shared']").text(String(sharedCounter.get())),
    ),
    lastInteraction.subscribe(() => renderLast()),
    attribution.subscribe(() => renderBars()),
    ball.subscribe(() => onStoreBall()),
    chat.subscribe(() => onStoreChat()),
    grid.subscribe(() => renderCells()),
    mood.subscribe(() => renderMood()),
  ];
  window.addEventListener(PING_EVENT, onPingEvent);

  showView("counters");
  renderLast();
  renderBars();
  renderBall();
  renderChat();
  renderCells();
  renderMood();

  return () => {
    window.removeEventListener(PING_EVENT, onPingEvent);
    window.clearTimeout(flashTimer);
    unsubs.forEach((unsub) => unsub());
    $root.off();
    $root.remove();
  };
};
