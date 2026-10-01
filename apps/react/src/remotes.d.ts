/*
 * Ambient types for federated exposes. Each remote's `./widget` expose
 * implements the shared WidgetModule contract; the wildcard module
 * declaration types every `import('<app>/widget')` without needing the
 * federation dts-plugin.
 */
declare module "*/widget" {
  import type { WidgetModule } from "@mf-all/widget-contract";

  export const mount: WidgetModule["mount"];
}
