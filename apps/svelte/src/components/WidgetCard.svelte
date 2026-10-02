<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { WidgetUnmount } from "@mf-all/widget-contract";
  import { APPS, type AppId } from "@mf-all/app-registry";
  import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
  import { loadWidget } from "../lib/widgets";

  let { id }: { id: AppId } = $props();

  const cfg = APPS[id];
  const meta = FRAMEWORKS[id];

  let status: "loading" | "ready" | "error" = $state("loading");
  let errorMessage = $state("");
  let loadMs: number | null = $state(null);
  let container: HTMLElement | undefined = $state();
  let unmount: WidgetUnmount | null = null;
  let loadId = 0;
  let autoRetried = false;

  async function mountWidget(): Promise<void> {
    loadId += 1;
    const currentLoad = loadId;

    // Tear down any previous instance, then retry from a clean container.
    unmount?.();
    unmount = null;
    if (container) container.innerHTML = "";
    status = "loading";
    errorMessage = "";

    try {
      const t0 = performance.now();
      const widget = await loadWidget(id);
      if (currentLoad !== loadId || !container) return;

      const result = widget.mount(container);
      if (result instanceof Promise) {
        const dispose = await result;
        if (currentLoad !== loadId) {
          dispose();
          return;
        }
        unmount = dispose;
      } else {
        unmount = result;
      }
      loadMs = Math.round(performance.now() - t0);
      status = "ready";
    } catch (error) {
      if (currentLoad !== loadId) return;
      console.error(`[mf] failed to load ${cfg.mfName}/widget`, error);
      errorMessage = error instanceof Error ? error.message : String(error);
      status = "error";
      // Self-heal transient cold-start failures with one automatic retry.
      if (!autoRetried) {
        autoRetried = true;
        setTimeout(() => {
          if (currentLoad === loadId && status === "error") void mountWidget();
        }, 2500);
      }
    } finally {
      // Watchdog: a hung remote load (promise never settles) gets the same
      // single automatic remount.
      setTimeout(() => {
        if (currentLoad === loadId && status === "loading") {
          try {
            const key = "mf-recovery";
            const lastRecovery = Number(sessionStorage.getItem(key) ?? "0");
            if (Date.now() - lastRecovery > 15000) {
              sessionStorage.setItem(key, String(Date.now()));
              location.reload();
              return;
            }
          } catch {
            // storage unavailable — fall through to the remount
          }
          void mountWidget();
        }
      }, 12000);
    }
  }

  onMount(() => {
    void mountWidget();
  });
  onDestroy(() => {
    loadId += 1;
    unmount?.();
  });
</script>

<article
  class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card"
>
  <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
    <span class="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{@html logoSvg(id, 18)}</span>
    <span class="text-sm font-semibold">{meta.label}</span>
    <span
      class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style:background-color="{meta.color}1a"
      style:color={meta.color}
      >{cfg.mfName}</span
    >
    <span class="ml-auto flex items-center gap-2">
      <span class="font-mono text-[11px] text-muted">:{cfg.port}</span>
      {#if loadMs !== null}
        <span class="font-mono text-[10px] text-muted" data-mf-loadtime>{loadMs} ms</span>
      {/if}
      <span
        class="h-1.5 w-1.5 rounded-full {status === 'loading'
          ? 'animate-pulse bg-amber-400'
          : status === 'ready'
            ? 'bg-ok'
            : 'bg-err'}"
      />
    </span>
  </header>

  <div class="relative flex-1 p-4">
    {#if status === "loading"}
      <div class="animate-pulse space-y-3">
        <div class="h-8 w-28 rounded-lg bg-border/70" />
        <div class="h-4 w-44 rounded bg-border/50" />
        <div class="h-8 w-32 rounded-lg bg-border/70" />
        <div class="h-4 w-40 rounded bg-border/50" />
      </div>
    {:else if status === "error"}
      <div class="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
        <p class="text-xs font-medium text-err">
          Couldn't load <span class="font-mono">{cfg.mfName}/widget</span>
        </p>
        <p class="text-[11px] text-muted">Is the remote dev server on :{cfg.port} running?</p>
        {#if errorMessage}
          <p class="mt-1 max-h-16 max-w-full overflow-hidden rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted">
            {errorMessage}
          </p>
        {/if}
        <button
          class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
          onclick={() => void mountWidget()}
        >
          Retry
        </button>
      </div>
    {/if}

    <div bind:this={container} class="min-h-[120px]"></div>
  </div>
</article>
