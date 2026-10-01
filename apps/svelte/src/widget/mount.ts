import { mount as svelteMount, unmount as svelteUnmount } from "svelte";
import "./widget.css";
import Widget from "./Widget.svelte";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * Svelte 5 imperative component API: mount() returns the component's
 * exports object, unmount() tears the instance down. One instance per mount.
 */
export const mount: WidgetModule["mount"] = (el) => {
  const instance = svelteMount(Widget, { target: el });
  return () => void svelteUnmount(instance);
};
