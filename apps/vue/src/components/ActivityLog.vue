<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const MAX_ENTRIES = 30;
const entries = ref<ActivityDetail[]>([]);

function onActivity(event: Event): void {
  const detail = (event as CustomEvent<ActivityDetail>).detail;
  entries.value = [detail, ...entries.value].slice(0, MAX_ENTRIES);
}

onMounted(() => window.addEventListener(ACTIVITY_EVENT, onActivity));
onUnmounted(() => window.removeEventListener(ACTIVITY_EVENT, onActivity));

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString();
}
</script>

<template>
  <section class="rounded-card border border-border bg-surface p-5 shadow-card">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="text-sm font-semibold">Activity log</h2>
      <p class="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
    </div>

    <p v-if="entries.length === 0" class="py-6 text-center text-xs text-muted">
      No activity yet — click around inside the widgets.
    </p>

    <ul v-else class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
      <li
        v-for="(entry, index) in entries"
        :key="entry.at + '-' + index"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg"
      >
        <span class="h-3.5 w-3.5 shrink-0" v-html="logoSvg(entry.app as AppId, 14)" />
        <span class="font-semibold">{{ FRAMEWORKS[entry.app as AppId]?.label ?? entry.app }}</span>
        <span class="truncate text-muted">{{ entry.message }}</span>
        <span class="ml-auto shrink-0 font-mono text-[11px] text-muted">{{ timeOf(entry.at) }}</span>
      </li>
    </ul>
  </section>
</template>
