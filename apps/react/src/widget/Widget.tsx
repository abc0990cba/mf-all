import { useSyncExternalStore, useState } from "react";
import type { Atom } from "nanostores";
import { lastInteraction, incrementShared, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";
import "./widget.css";

const SELF: AppId = "react";
const meta = FRAMEWORKS[SELF];

function useStore<T>(store: Atom<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

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
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-3.5">
        <section>
          <span className="mfw-label">Local · useState()</span>
          <div className="flex items-center gap-2.5">
            <button type="button" className="mfw-btn" onClick={() => setLocal((n) => n + 1)}>
              Local +1
            </button>
            <span className="mfw-value">{local}</span>
          </div>
        </section>

        <section>
          <span className="mfw-label">Shared · platform-memoized atom</span>
          <div className="flex items-center gap-2.5">
            <button type="button" className="mfw-btn-accent" onClick={onShared}>
              Shared +1
            </button>
            <span className="mfw-value">{shared}</span>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between">
        <span className="mfw-foot flex items-center gap-1.5">
          last:
          {last ? (
            <>
              <span
                className="inline-block [&>svg]:h-3 [&>svg]:w-3"
                dangerouslySetInnerHTML={{ __html: logoSvg(last.app as AppId, 12) }}
              />
              <span className="font-medium text-ink">{FRAMEWORKS[last.app as AppId]?.label}</span>
            </>
          ) : (
            "—"
          )}
        </span>
        <button
          type="button"
          className="mfw-foot underline-offset-2 hover:text-ink hover:underline"
          onClick={onLog}
        >
          log event
        </button>
      </div>
    </div>
  );
}
