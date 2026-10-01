import type { AppId } from "@mf-all/app-registry";
import type { WidgetModule } from "@mf-all/widget-contract";

/**
 * Host-side widget loaders.
 *
 * The remote specifiers must be static literals: the federation plugin
 * rewrites them into runtime `loadRemote()` calls (and registers the
 * remotes) at build time. The host's own widget is imported locally — a
 * network hop to yourself buys nothing.
 *
 * Loads are SERIALIZED through a module-level queue: nine remotes coming
 * back at once makes their first-load init race (the known bidirectional
 * dev deadlock, module-federation/vite#180/#733) — one-at-a-time keeps the
 * mesh deterministic on cold starts. Widget types come from the ambient
 * wildcard declaration in remotes.d.ts, backed by @mf-all/widget-contract.
 */
const loaders: Record<AppId, () => Promise<WidgetModule>> = {
  vue: () => import("vueApp/widget"),
  react: () => import("reactApp/widget"),
  angular: () => import("angularApp/widget"),
  svelte: () => import("svelteApp/widget"),
  solid: () => import("solidApp/widget"),
  preact: () => import("preactApp/widget"),
  lit: () => import("litApp/widget"),
  alpine: () => import("alpineApp/widget"),
  jquery: () => import("jqueryApp/widget"),
};

let queue: Promise<unknown> = Promise.resolve();

export function loadWidget(id: AppId): Promise<WidgetModule> {
  const load = () => loaders[id]();
  const result = queue.then(load, load);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
