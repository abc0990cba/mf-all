import { render } from "solid-js/web";
import "./widget.css";
import { Widget } from "./Widget";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * Solid's render() already returns the dispose function — the widget
 * contract maps 1:1. One reactive tree per mount instance.
 */
export const mount: WidgetModule["mount"] = (el) => {
  return render(() => <Widget />, el);
};
