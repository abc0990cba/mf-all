import { render } from "preact";
import "./widget.css";
import { Widget } from "./Widget";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * Preact teardown is render(null, container) — removes the tree and its DOM.
 * One tree per mount instance.
 */
export const mount: WidgetModule["mount"] = (el) => {
  render(<Widget />, el);
  return () => {
    render(null, el);
  };
};
