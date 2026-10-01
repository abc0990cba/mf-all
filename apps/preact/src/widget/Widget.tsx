import { useState } from "preact/hooks";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";
import { incrementShared, lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";
import { useStore } from "../lib/store";
import "./widget.css";

const SELF: AppId = "preact";
const meta = FRAMEWORKS[SELF];

export function Widget() {
  const [local, setLocal] = useState(0);
  const shared = useStore(sharedCounter);
  const last = useStore(lastInteraction);

  function onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  }

  function onLog(): void {
    emitActivity(SELF, `says hello from ${meta.label}`);
  }

  return (
    <div class="flex h-full flex-col justify-between gap-4">
      <div class="space-y-3.5">
        <section>
          <span class="mfw-label">Local · useState() · 4 kB runtime</span>
          <div class="flex items-center gap-2.5">
            <button type="button" class="mfw-btn" onClick={() => setLocal((n) => n + 1)}>
              Local +1
            </button>
            <span class="mfw-value">{local}</span>
          </div>
        </section>

        <section>
          <span class="mfw-label">Shared · platform-memoized atom</span>
          <div class="flex items-center gap-2.5">
            <button type="button" class="mfw-btn-accent" onClick={onShared}>
              Shared +1
            </button>
            <span class="mfw-value">{shared}</span>
          </div>
        </section>
      </div>

      <div class="flex items-center justify-between">
        <span class="mfw-foot flex items-center gap-1.5">
          last:
          {last ? (
            <>
              <span
                class="inline-block"
                dangerouslySetInnerHTML={{ __html: logoSvg(last.app as AppId, 12) }}
              />
              <span class="font-medium text-ink">{FRAMEWORKS[last.app as AppId]?.label}</span>
            </>
          ) : (
            "—"
          )}
        </span>
        <button
          type="button"
          class="mfw-foot underline-offset-2 hover:text-ink hover:underline"
          onClick={onLog}
        >
          log event
        </button>
      </div>
    </div>
  );
}
