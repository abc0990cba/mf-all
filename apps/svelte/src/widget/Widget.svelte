<script lang="ts">
  import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";
  import { incrementShared, lastInteraction, sharedCounter } from "@mf-all/shared-store";
  import { emitActivity } from "@mf-all/widget-contract";

  const SELF: AppId = "svelte";
  const meta = FRAMEWORKS[SELF];

  let local = $state(0);
  let shared = $state(sharedCounter.get());
  let last = $state(lastInteraction.get());

  $effect(() => {
    const unsubCounter = sharedCounter.subscribe((value) => (shared = value));
    const unsubLast = lastInteraction.subscribe((value) => (last = value));
    return () => {
      unsubCounter();
      unsubLast();
    };
  });

  function onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  }

  function onLog(): void {
    emitActivity(SELF, `says hello from ${meta.label}`);
  }
</script>

<div class="flex h-full flex-col justify-between gap-4">
  <div class="space-y-3.5">
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
