import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const MAX_ENTRIES = 30;

export function ActivityLog() {
  const [entries, setEntries] = createSignal<ActivityDetail[]>([]);

  const onActivity = (event: Event): void => {
    const detail = (event as CustomEvent<ActivityDetail>).detail;
    setEntries((prev) => [detail, ...prev].slice(0, MAX_ENTRIES));
  };

  onMount(() => window.addEventListener(ACTIVITY_EVENT, onActivity));
  onCleanup(() => window.removeEventListener(ACTIVITY_EVENT, onActivity));

  return (
    <section class="rounded-card border border-border bg-surface p-5 shadow-card">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-sm font-semibold">Activity log</h2>
        <p class="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <p class="py-6 text-center text-xs text-muted">
            No activity yet — click around inside the widgets.
          </p>
        }
      >
        <ul class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          <For each={entries()}>
            {(entry, index) => (
              <li
                class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg"
                data-key={`${entry.at}-${index()}`}
              >
                <span class="shrink-0" innerHTML={logoSvg(entry.app as AppId, 14)} />
                <span class="font-semibold">
                  {FRAMEWORKS[entry.app as AppId]?.label ?? entry.app}
                </span>
                <span class="truncate text-muted">{entry.message}</span>
                <span class="ml-auto shrink-0 font-mono text-[11px] text-muted">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
