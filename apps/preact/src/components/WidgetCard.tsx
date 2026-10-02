import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { WidgetUnmount } from "@mf-all/widget-contract";
import { APPS, type AppId } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
import { loadWidget } from "../lib/widgets";

interface Props {
  app: AppId;
}

export function WidgetCard({ app }: Props) {
  const cfg = APPS[app];
  const meta = FRAMEWORKS[app];

  const containerRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<WidgetUnmount | null>(null);
  const loadIdRef = useRef(0);
  const autoRetriedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadMs, setLoadMs] = useState<number | null>(null);

  const mountWidget = useCallback(async () => {
    loadIdRef.current += 1;
    const id = loadIdRef.current;
    const settled = { v: false };

    // Tear down any previous instance, then retry from a clean container.
    unmountRef.current?.();
    unmountRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = "";
    setStatus("loading");
    setErrorMessage("");

    try {
      const t0 = performance.now();
      const widget = await loadWidget(app);
      if (id !== loadIdRef.current || !containerRef.current) return;

      const result = widget.mount(containerRef.current);
      if (result instanceof Promise) {
        const dispose = await result;
        if (id !== loadIdRef.current) {
          dispose();
          return;
        }
        unmountRef.current = dispose;
      } else {
        unmountRef.current = result;
      }
      setLoadMs(Math.round(performance.now() - t0));
      setStatus("ready");
      settled.v = true;
    } catch (error) {
      settled.v = true;
      if (id !== loadIdRef.current) return;
      console.error(`[mf] failed to load ${cfg.mfName}/widget`, error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
      // Self-heal transient cold-start failures with one automatic retry.
      if (!autoRetriedRef.current) {
        autoRetriedRef.current = true;
        setTimeout(() => {
          if (id === loadIdRef.current) void mountWidget();
        }, 2500);
      }
    } finally {
      // Watchdog: a hung remote load (promise never settles) gets the same
      // single automatic remount.
      setTimeout(() => {
        if (!settled.v && id === loadIdRef.current) {
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
  }, [app, cfg.mfName]);

  useEffect(() => {
    void mountWidget();
    return () => {
      loadIdRef.current += 1;
      unmountRef.current?.();
    };
  }, [mountWidget]);

  return (
    <article class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span class="shrink-0" dangerouslySetInnerHTML={{ __html: logoSvg(app, 18) }} />
        <span class="text-sm font-semibold">{meta.label}</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
        >
          {cfg.mfName}
        </span>
        <span class="ml-auto flex items-center gap-2">
          <span class="font-mono text-[11px] text-muted">:{cfg.port}</span>
          {loadMs !== null && (
            <span class="font-mono text-[10px] text-muted" data-mf-loadtime>
              {loadMs} ms
            </span>
          )}
          <span
            class={`h-1.5 w-1.5 rounded-full ${
              status === "loading"
                ? "animate-pulse bg-amber-400"
                : status === "ready"
                  ? "bg-ok"
                  : "bg-err"
            }`}
          />
        </span>
      </header>

      <div class="relative flex-1 p-4">
        {status === "loading" && (
          <div class="absolute inset-4 animate-pulse space-y-3">
            <div class="h-8 w-28 rounded-lg bg-border/70" />
            <div class="h-4 w-44 rounded bg-border/50" />
            <div class="h-8 w-32 rounded-lg bg-border/70" />
            <div class="h-4 w-40 rounded bg-border/50" />
          </div>
        )}

        {status === "error" && (
          <div class="absolute inset-4 flex flex-col items-center justify-center gap-2 text-center">
            <p class="text-xs font-medium text-err">
              Couldn't load <span class="font-mono">{cfg.mfName}/widget</span>
            </p>
            <p class="text-[11px] text-muted">Is the remote dev server on :{cfg.port} running?</p>
            {errorMessage && (
              <p class="mt-1 max-h-16 max-w-full overflow-hidden rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted">
                {errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => void mountWidget()}
              class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={containerRef} class="min-h-[120px]" />
      </div>
    </article>
  );
}
