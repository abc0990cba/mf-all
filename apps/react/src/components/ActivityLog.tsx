import { useEffect, useState } from "react";
import { ACTIVITY_EVENT, type ActivityDetail } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const MAX_ENTRIES = 30;

export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityDetail[]>([]);

  useEffect(() => {
    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      setEntries((prev) => [detail, ...prev].slice(0, MAX_ENTRIES));
    };
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(ACTIVITY_EVENT, onActivity);
  }, []);

  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Activity log</h2>
        <p className="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          No activity yet — click around inside the widgets.
        </p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {entries.map((entry, index) => (
            <li
              key={`${entry.at}-${index}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg"
            >
              <span
                className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5"
                dangerouslySetInnerHTML={{ __html: logoSvg(entry.app as AppId, 14) }}
              />
              <span className="font-semibold">
                {FRAMEWORKS[entry.app as AppId]?.label ?? entry.app}
              </span>
              <span className="truncate text-muted">{entry.message}</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">
                {new Date(entry.at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
