<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
  import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

  const MAX_ENTRIES = 30;

  let entries: ActivityDetail[] = $state([]);

  function onActivity(event: Event): void {
    const detail = (event as CustomEvent<ActivityDetail>).detail;
    entries = [detail, ...entries].slice(0, MAX_ENTRIES);
  }

  onMount(() => window.addEventListener(ACTIVITY_EVENT, onActivity));
  onDestroy(() => window.removeEventListener(ACTIVITY_EVENT, onActivity));
</script>

<section class="rounded-card border border-border bg-surface p-5 shadow-card">
  <div class="mb-3 flex items-baseline justify-between">
    <h2 class="text-sm font-semibold">Activity log</h2>
    <p class="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
  </div>

  {#if entries.length === 0}
    <p class="py-6 text-center text-xs text-muted">No activity yet — click around inside the widgets.</p>
  {:else}
    <ul class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
      {#each entries as entry, index (entry.at + "-" + index)}
        <li class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg">
          <span class="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5"
            >{@html logoSvg(entry.app as AppId, 14)}</span
          >
          <span class="font-semibold">{FRAMEWORKS[entry.app as AppId]?.label ?? entry.app}</span>
          <span class="truncate text-muted">{entry.message}</span>
          <span class="ml-auto shrink-0 font-mono text-[11px] text-muted"
            >{new Date(entry.at).toLocaleTimeString()}</span
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>
