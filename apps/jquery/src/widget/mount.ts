import $ from "jquery";
import "./widget.css";
import { incrementShared, lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg, type AppId } from "@mf-all/ui";

const SELF: AppId = "jquery";
const meta = FRAMEWORKS[SELF];

/**
 * The widget markup. NOTE: no leading whitespace — jQuery 4 only treats a
 * string as HTML when it starts with "<"; leading whitespace makes $()
 * parse it as a selector (returning an empty set).
 */
const WIDGET_MARKUP = `<div class="flex h-full flex-col justify-between gap-4">
  <div class="space-y-3.5">
    <section>
      <span class="mfw-label">Local · jQuery events</span>
      <div class="flex items-center gap-2.5">
        <button type="button" class="mfw-btn" data-action="local">Local +1</button>
        <span class="mfw-value" data-out="local">0</span>
      </div>
    </section>

    <section>
      <span class="mfw-label">Shared · platform-memoized atom</span>
      <div class="flex items-center gap-2.5">
        <button type="button" class="mfw-btn-accent" data-action="shared">Shared +1</button>
        <span class="mfw-value" data-out="shared">${sharedCounter.get()}</span>
      </div>
    </section>
  </div>

  <div class="flex items-center justify-between">
    <span class="mfw-foot flex items-center gap-1.5">
      last:
      <span data-out="last">—</span>
    </span>
    <button
      type="button"
      class="mfw-foot underline-offset-2 hover:text-ink hover:underline"
      data-action="log"
    >
      log event
    </button>
  </div>
</div>`;

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * The jQuery widget is the "legacy remote" of the demo: plain DOM built and
 * wired with jQuery events — no framework runtime, no plugin, no shared
 * deps. Teardown unsubscribes the store listeners, unwires the handlers and
 * removes the node (the `.off("click")` sweep prevents listener leaks).
 */
export const mount = (el: HTMLElement): (() => void) => {
  let local = 0;

  const $root = $(WIDGET_MARKUP);
  $(el).append($root);

  const renderLast = (): void => {
    const last = lastInteraction.get();
    const $out = $root.find("[data-out='last']");
    if (!last) {
      $out.text("—");
      return;
    }
    $out
      .empty()
      .append(`<span class="inline-block">${logoSvg(last.app, 12)}</span>`)
      .append(`<span class="font-medium text-ink">${FRAMEWORKS[last.app as AppId]?.label}</span>`);
  };

  const onLocal = (): void => {
    local += 1;
    $root.find("[data-out='local']").text(String(local));
  };

  const onShared = (): void => {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  };

  const onLog = (): void => {
    emitActivity(SELF, `says hello from ${meta.label}`);
  };

  const onSharedStoreChange = (): void => {
    $root.find("[data-out='shared']").text(String(sharedCounter.get()));
  };

  const onLastStoreChange = (): void => renderLast();

  // Wire events + store subscriptions
  $root.find("[data-action='local']").on("click", onLocal);
  $root.find("[data-action='shared']").on("click", onShared);
  $root.find("[data-action='log']").on("click", onLog);
  const unsubs = [
    sharedCounter.subscribe(onSharedStoreChange),
    lastInteraction.subscribe(onLastStoreChange),
  ];
  renderLast();

  return () => {
    $root.find("button").off("click");
    unsubs.forEach((unsub) => unsub());
    $root.remove();
  };
};
