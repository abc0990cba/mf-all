import { createApp } from "vue";
import "./widget.css";
import Widget from "./Widget.vue";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * createApp() per mount instance; unmount() tears down the component tree,
 * its listeners and its DOM. One Vue instance per widget — page-global state
 * flows through @mf-all/shared-store, not through app singletons.
 */
export const mount: WidgetModule["mount"] = (el) => {
  const app = createApp(Widget);
  app.mount(el);
  return () => app.unmount();
};
