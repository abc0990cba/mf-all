<script lang="ts">
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

  const SELF: AppId = "svelte";
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

  let local = $state(0);
  let tab = $state<TabId>("counters");
  let draft = $state("");
  let pingsGot = $state(0);
  let flash = $state(false);
  let unseen = $state({ ball: false, chat: false, pulse: false });

  let shared = $state(sharedCounter.get());
  let last = $state(lastInteraction.get());
  let who = $state(attribution.get());
  let ballState = $state(ball.get());
  let messages = $state(chat.get());
  let cells = $state(grid.get());
  let currentMood = $state(mood.get());

  let currentTab: TabId = "counters";
  let seenChatAt: number | null = null;
  let prevHolder: string | null = ballState.holder;
  let flashTimer: number | undefined;

  $effect(() => {
    const unsubCounter = sharedCounter.subscribe((v) => (shared = v));
    const unsubLast = lastInteraction.subscribe((v) => (last = v));
    const unsubWho = attribution.subscribe((v) => (who = v));
    const unsubBall = ball.subscribe((v) => {
      const arrived = v.holder === SELF && prevHolder !== SELF;
      prevHolder = v.holder;
      ballState = v;
      if (arrived && currentTab !== "ball") unseen.ball = true;
    });
    const unsubChat = chat.subscribe((v) => {
      messages = v;
      const lastAt = v.length > 0 ? v[v.length - 1].at : 0;
      if (currentTab === "chat" || seenChatAt === null) {
        seenChatAt = lastAt;
      } else if (lastAt > seenChatAt) {
        unseen.chat = true;
      }
    });
    const unsubGrid = grid.subscribe((v) => (cells = v));
    const unsubMood = mood.subscribe((v) => (currentMood = v));
    return () => {
      unsubCounter();
      unsubLast();
      unsubWho();
      unsubBall();
      unsubChat();
      unsubGrid();
      unsubMood();
    };
  });

  $effect(() => {
    const onPingEvent = (e: Event): void => {
      const detail = (e as CustomEvent<PingDetail>).detail;
      if (detail.app === SELF) return;
      pingsGot += 1;
      flash = true;
      if (currentTab !== "pulse") unseen.pulse = true;
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => (flash = false), 600);
    };
    window.addEventListener(PING_EVENT, onPingEvent);
    return () => window.removeEventListener(PING_EVENT, onPingEvent);
  });

  function openTab(next: TabId): void {
    currentTab = next;
    tab = next;
    if (next === "ball" || next === "chat" || next === "pulse") unseen[next] = false;
  }

  function hasDot(id: TabId): boolean {
    return id === "ball" || id === "chat" || id === "pulse" ? unseen[id] : false;
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
    draft = "";
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
    const max = Math.max(1, ...APP_IDS.map((a) => who[a] ?? 0));
    return `${2 + ((who[id] ?? 0) / max) * 14}px`;
  }

  const holderMeta = $derived(ballState.holder ? FRAMEWORKS[ballState.holder as AppId] : null);
  const herePort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  const identityLabel =
    herePort === String(APPS[SELF].port) ? "running at home" : `federated guest on :${herePort}`;
</script>

<div class="flex h-full flex-col justify-between gap-3" class:mfw-flash={flash}>
  <div>
    <div class="mfw-tabs" role="tablist">
      {#each TABS as t (t.id)}
        <button
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          data-mf-tab={t.id}
          class="mfw-tab"
          onclick={() => openTab(t.id)}
        >
          {t.label}
          {#if hasDot(t.id)}<span class="mfw-dot"></span>{/if}
        </button>
      {/each}
    </div>

    {#if tab === "counters"}
      <div class="mt-3 space-y-3.5">
        <section>
          <span class="mfw-label">Local · $state rune</span>
          <div class="flex items-center gap-2.5">
            <button class="mfw-btn" onclick={() => local++}>Local +1</button>
            <span class="mfw-value">{local}</span>
          </div>
        </section>

        <section>
          <span class="mfw-label">Shared · platform-memoized atom</span>
          <div class="flex items-center gap-2.5">
            <button class="mfw-btn-accent" onclick={onShared}>Shared +1</button>
            <span class="mfw-value">{shared}</span>
          </div>
        </section>

        <section data-mf-bars>
          <span class="mfw-label">Who clicked shared</span>
          <div class="mfw-bars">
            {#each APP_IDS as id (id)}
              <span
                class="mfw-bar-item"
                data-mf-bar={id}
                data-count={who[id] ?? 0}
                title={`${FRAMEWORKS[id].label}: ${who[id] ?? 0}`}
              >
                <span class="mfw-bar" style={`height: ${barHeight(id)}`}></span>
                <span class="mfw-bar-logo">{@html logoSvg(id, 10)}</span>
              </span>
            {/each}
          </div>
        </section>
      </div>
    {:else if tab === "ball"}
      <div class="mt-3" data-mf-ball-view>
        {#if ballState.holder === SELF}
          <div class="flex flex-col items-center gap-1">
            <button
              type="button"
              class="mfw-ball"
              data-mf-ball
              title="Pass the ball to another widget"
              onclick={onPassBall}
            >
              {ballState.passes}
            </button>
            <span class="mfw-foot">click to pass</span>
          </div>
        {:else if holderMeta}
          <div class="flex items-center justify-center gap-1.5 py-3.5" data-mf-ball-holder>
            <span class="mfw-foot">ball at:</span>
            <span class="inline-block h-3.5 w-3.5">{@html logoSvg(holderMeta.id, 14)}</span>
            <span class="text-xs font-medium text-ink">{holderMeta.label}</span>
          </div>
        {/if}
      </div>
    {:else if tab === "board"}
      <div class="mt-3">
        <span class="mfw-label">Shared canvas · 5×5</span>
        <div class="mfw-grid" data-mf-board>
          {#each CELLS as i (i)}
            <button
              type="button"
              aria-label={`cell ${cellKey(i)}`}
              data-mf-grid-cell={cellKey(i)}
              class={`mfw-cell${cells[cellKey(i)] ? " is-on" : ""}`}
              onclick={() => onCell(i)}
            ></button>
          {/each}
        </div>
      </div>
    {:else if tab === "chat"}
      <div class="mt-3 space-y-2">
        <div class="mfw-chat-log" data-mf-chat-log>
          {#if messages.length === 0}
            <span class="mfw-foot">no messages yet</span>
          {:else}
            {#each messages as m, i (`${m.at}-${i}`)}
              <div class="flex items-baseline gap-1.5">
                <span class="inline-block h-2.5 w-2.5">{@html logoSvg(m.app as AppId, 10)}</span>
                <span class="mfw-foot shrink-0">{FRAMEWORKS[m.app as AppId]?.label ?? m.app}</span>
                <span class="truncate text-xs text-ink" data-mf-chat-msg>{m.text}</span>
              </div>
            {/each}
          {/if}
        </div>
        <form
          class="flex items-center gap-1.5"
          onsubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <input class="mfw-chat-input" data-mf-chat-input placeholder="say hi to the mesh…" bind:value={draft} />
          <button type="submit" class="mfw-btn" data-mf-chat-send>Send</button>
        </form>
      </div>
    {:else if tab === "pulse"}
      <div class="mt-3 space-y-3">
        <div class="flex items-center gap-2.5">
          <button type="button" class="mfw-btn-accent" data-mf-ping onclick={onPing}>Ping ×8</button>
          <span class="mfw-value" data-mf-ping-count>{pingsGot}</span>
          <span class="mfw-foot">got</span>
        </div>

        <div class="flex items-center gap-2.5">
          <span class="text-lg" data-mf-mood>{currentMood}</span>
          {#each MOODS as m (m)}
            <button type="button" class="mfw-mood-btn" data-mf-mood-set={m} onclick={() => onMood(m)}>
              {m}
            </button>
          {/each}
        </div>

        <span class="mfw-foot block" data-mf-identity>{identityLabel}</span>
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-between">
    <span class="mfw-foot flex items-center gap-1.5">
      last:
      {#if last}
        <span class="inline-block [&>svg]:h-3 [&>svg]:w-3">{@html logoSvg(last.app as AppId, 12)}</span>
        <span class="font-medium text-ink">{FRAMEWORKS[last.app as AppId]?.label}</span>
      {:else}
        —
      {/if}
    </span>
    <button class="mfw-foot underline-offset-2 hover:text-ink hover:underline" onclick={onLog}>
      log event
    </button>
  </div>
</div>
