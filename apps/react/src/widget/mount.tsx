import { createRoot } from "react-dom/client";
import "./widget.css";
import { Widget } from "./Widget";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * One React root per mount instance; root.unmount() tears down the tree and
 * its DOM. Page-global state flows through @mf-all/shared-store.
 */
export const mount: WidgetModule["mount"] = (el) => {
  const root = createRoot(el);
  root.render(<Widget />);
  return () => root.unmount();
};
