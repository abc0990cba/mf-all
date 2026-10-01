<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { lastInteraction, incrementShared, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const SELF: AppId = "vue";
const meta = FRAMEWORKS[SELF];

const local = ref(0);
const shared = ref(sharedCounter.get());
const last = ref(lastInteraction.get());

const unsubCounter = sharedCounter.subscribe((value) => (shared.value = value));
const unsubLast = lastInteraction.subscribe((value) => (last.value = value));
onScopeDispose(() => {
  unsubCounter();
  unsubLast();
});

function onShared(): void {
  incrementShared(SELF);
  emitActivity(SELF, "incremented the shared counter");
}

function onLog(): void {
  emitActivity(SELF, `says hello from ${meta.label}`);
}
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-4">
    <div class="space-y-3.5">
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
