/**
 * The widget contract — the only interface between hosts and remotes.
 *
 * Every app exposes `./widget`, a framework-agnostic module with a single
 * `mount(el)` function that renders the widget into a DOM element and returns
 * an unmount/dispose function. Angular's mount is async (createApplication
 * resolves an ApplicationRef), hence the promise union in the contract.
 *
 * This mirrors the official cross-framework pattern (shared-store-cross-framework)
 * with one fix: the disposer is actually returned and called — no leaks.
 */

export type WidgetUnmount = () => void;

export interface WidgetModule {
  mount(el: HTMLElement): WidgetUnmount | Promise<WidgetUnmount>;
}

/**
 * Cross-framework activity feed. Widgets dispatch DOM CustomEvents instead of
 * importing host code — loose coupling across the federation boundary.
 */
export const ACTIVITY_EVENT = "mf:activity";

export interface ActivityDetail {
  /** AppId of the emitting widget. */
  app: string;
  message: string;
  at: number;
}

export function emitActivity(app: string, message: string): void {
  window.dispatchEvent(
    new CustomEvent<ActivityDetail>(ACTIVITY_EVENT, {
      detail: { app, message, at: Date.now() },
    }),
  );
}
