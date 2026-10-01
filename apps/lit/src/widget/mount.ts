import { MfLitWidget } from "./widget";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * Lit widgets are custom elements: the mount contract degenerates to
 * defining the tag (idempotent — the import above evaluates widget.ts,
 * which registers it) and creating the element — no framework render root
 * needed. Any host could also skip the contract and use <mf-lit-widget>
 * directly; that's the Web-Components superpower.
 */
export const mount: WidgetModule["mount"] = (el) => {
  if (!customElements.get("mf-lit-widget")) {
    customElements.define("mf-lit-widget", MfLitWidget);
  }
  const node = document.createElement("mf-lit-widget");
  el.appendChild(node);
  return () => {
    node.remove();
  };
};
