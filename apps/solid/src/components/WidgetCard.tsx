import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { WidgetUnmount } from "@mf-all/widget-contract";
import { APPS, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
import { loadWidget } from "../lib/widgets";

interface Props {
  app: AppId;
}

export function WidgetCard(props: Props) {
  const cfg = APPS[props.app];
  const meta = FRAMEWORKS[props.app];

  const [status, setStatus] = createSignal<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = createSignal("");

  let container: HTMLDivElement | undefined;
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
    setStatus("loading");
    setErrorMessage("");

    try {
      const widget = await loadWidget(props.app);
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
      setStatus("ready");
    } catch (error) {
      if (currentLoad !== loadId) return;
      console.error(`[mf] failed to load ${cfg.mfName}/widget`, error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
      // Self-heal transient cold-start failures with one automatic retry.
      if (!autoRetried) {
        autoRetried = true;
        setTimeout(() => {
          if (currentLoad === loadId && status() === "error") void mountWidget();
        }, 2500);
      }
    } finally {
      // Watchdog: a hung remote load (promise never settles) gets the same
      // single automatic remount.
      setTimeout(() => {
        if (currentLoad === loadId && status() === "loading") {
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
  onCleanup(() => {
    loadId += 1;
    unmount?.();
  });

  return (
    <article class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span class="shrink-0" innerHTML={logoSvg(props.app, 18)} />
        <span class="text-sm font-semibold">{meta.label}</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ "background-color": `${meta.color}1a`, color: meta.color }}
        >
          {cfg.mfName}
        </span>
        <span class="ml-auto flex items-center gap-2">
          <span class="font-mono text-[11px] text-muted">:{cfg.port}</span>
          <span
            class="h-1.5 w-1.5 rounded-full"
            classList={{
              "animate-pulse bg-amber-400": status() === "loading",
              "bg-ok": status() === "ready",
              "bg-err": status() === "error",
            }}
          />
        </span>
      </header>

      <div class="relative flex-1 p-4">
        <Show when={status() === "loading"}>
          <div class="animate-pulse space-y-3">
            <div class="h-8 w-28 rounded-lg bg-border/70" />
            <div class="h-4 w-44 rounded bg-border/50" />
            <div class="h-8 w-32 rounded-lg bg-border/70" />
            <div class="h-4 w-40 rounded bg-border/50" />
          </div>
        </Show>

        <Show when={status() === "error"}>
          <div class="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <p class="text-xs font-medium text-err">
              Couldn't load <span class="font-mono">{cfg.mfName}/widget</span>
            </p>
            <p class="text-[11px] text-muted">
              Is the remote dev server on :{cfg.port} running?
            </p>
            <Show when={errorMessage()}>
              <p class="mt-1 max-h-16 max-w-full overflow-hidden rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted">
                {errorMessage()}
              </p>
            </Show>
            <button
              type="button"
              class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
              onClick={() => void mountWidget()}
            >
              Retry
            </button>
          </div>
        </Show>

        <div ref={container} class="min-h-[120px]" />
      </div>
    </article>
  );
}
