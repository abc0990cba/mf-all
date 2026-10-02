<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import type { WidgetUnmount } from "@mf-all/widget-contract";
import { APPS, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
import { loadWidget } from "../lib/widgets";

const props = defineProps<{ app: AppId }>();

const cfg = APPS[props.app];
const meta = FRAMEWORKS[props.app];

const status = ref<"loading" | "ready" | "error">("loading");
const errorMessage = ref<string>("");
const loadMs = ref<number | null>(null);
const container = ref<HTMLElement | null>(null);
const unmount = shallowRef<WidgetUnmount | null>(null);
let loadId = 0;
let autoRetried = false;

async function mountWidget(): Promise<void> {
  loadId += 1;
  const id = loadId;

  // Tear down any previous instance, then retry from a clean container.
  unmount.value?.();
  unmount.value = null;
  if (container.value) container.value.innerHTML = "";
  status.value = "loading";
  errorMessage.value = "";

  try {
    const t0 = performance.now();
    const widget = await loadWidget(props.app);
    if (id !== loadId || !container.value) return;

    const result = widget.mount(container.value);
    if (result instanceof Promise) {
      const dispose = await result;
      if (id !== loadId) {
        dispose();
        return;
      }
      unmount.value = dispose;
    } else {
      unmount.value = result;
    }
    loadMs.value = Math.round(performance.now() - t0);
    status.value = "ready";
  } catch (error) {
    if (id !== loadId) return;
    console.error(`[mf] failed to load ${cfg.mfName}/widget`, error);
    errorMessage.value = error instanceof Error ? error.message : String(error);
    status.value = "error";
    // Self-heal transient cold-start failures (dep re-optimization, container
    // init races) with one automatic retry; manual retry stays available.
    if (!autoRetried) {
      autoRetried = true;
      setTimeout(() => {
        if (id === loadId && status.value === "error") void mountWidget();
      }, 2500);
    }
  } finally {
    // Watchdog: a hung remote load (rare runtime edge — the promise never
    // settles) gets the same single automatic remount.
    setTimeout(() => {
      if (id === loadId && status.value === "loading") {
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

onMounted(mountWidget);
onUnmounted(() => {
  loadId += 1;
  unmount.value?.();
});
</script>

<template>
  <article
    class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card"
  >
    <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
      <span class="h-[18px] w-[18px] shrink-0" v-html="logoSvg(props.app, 18)" />
      <span class="text-sm font-semibold">{{ meta.label }}</span>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
        :style="{ backgroundColor: `${meta.color}1a`, color: meta.color }"
        >{{ cfg.mfName }}</span
      >
      <span class="ml-auto flex items-center gap-2">
        <span class="font-mono text-[11px] text-muted">:{{ cfg.port }}</span>
        <span v-if="loadMs !== null" class="font-mono text-[10px] text-muted" data-mf-loadtime>
          {{ loadMs }} ms
        </span>
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="{
            'animate-pulse bg-amber-400': status === 'loading',
            'bg-ok': status === 'ready',
            'bg-err': status === 'error',
          }"
        />
      </span>
    </header>

    <div class="relative flex-1 p-4">
      <div v-if="status === 'loading'" class="animate-pulse space-y-3">
        <div class="h-8 w-28 rounded-lg bg-border/70" />
        <div class="h-4 w-44 rounded bg-border/50" />
        <div class="h-8 w-32 rounded-lg bg-border/70" />
        <div class="h-4 w-40 rounded bg-border/50" />
      </div>

      <div
        v-else-if="status === 'error'"
        class="flex h-full flex-col items-center justify-center gap-2 py-6 text-center"
      >
        <p class="text-xs font-medium text-err">
          Couldn't load <span class="font-mono">{{ cfg.mfName }}/widget</span>
        </p>
        <p class="text-[11px] text-muted">Is the remote dev server on :{{ cfg.port }} running?</p>
        <p
          v-if="errorMessage"
          class="max-h-16 max-w-full overflow-hidden overflow-ellipsis rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted"
        >
          {{ errorMessage }}
        </p>
        <button
          class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
          @click="mountWidget"
        >
          Retry
        </button>
      </div>

      <div ref="container" class="min-h-[120px]" />
    </div>
  </article>
</template>
