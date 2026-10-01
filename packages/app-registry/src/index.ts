/**
 * The remote registry — the deployment contract of the whole playground.
 *
 * Every app's vite.config.ts derives its dev-server port, its own origin and
 * its `remotes` map from here, and URLs can be overridden per environment with
 * `MF_ORIGIN_<APP>` (e.g. MF_ORIGIN_REACT=https://react.acme.com) at build
 * time — the documented production pattern for env-specific remote URLs.
 *
 * Pure TS with zero dependencies: imported by vite.config.ts (Node) and by
 * app runtime code (browser) alike.
 */

export type AppId =
  | "vue"
  | "react"
  | "angular"
  | "svelte"
  | "solid"
  | "preact"
  | "lit"
  | "alpine"
  | "jquery";

export interface AppConfig {
  id: AppId;
  /** Module Federation container name (must be a valid JS identifier). */
  mfName: string;
  /** Workspace package name of the app. */
  pkg: string;
  /** Human-readable framework label. */
  label: string;
  /** Fixed dev/preview port — every app must be reachable at a stable URL. */
  port: number;
}

export const APPS: Record<AppId, AppConfig> = {
  vue: { id: "vue", mfName: "vueApp", pkg: "@mf-all/app-vue", label: "Vue", port: 5173 },
  react: { id: "react", mfName: "reactApp", pkg: "@mf-all/app-react", label: "React", port: 5174 },
  angular: { id: "angular", mfName: "angularApp", pkg: "@mf-all/app-angular", label: "Angular", port: 5175 },
  svelte: { id: "svelte", mfName: "svelteApp", pkg: "@mf-all/app-svelte", label: "Svelte", port: 5176 },
  solid: { id: "solid", mfName: "solidApp", pkg: "@mf-all/app-solid", label: "Solid", port: 5177 },
  preact: { id: "preact", mfName: "preactApp", pkg: "@mf-all/app-preact", label: "Preact", port: 5178 },
  lit: { id: "lit", mfName: "litApp", pkg: "@mf-all/app-lit", label: "Lit", port: 5179 },
  alpine: { id: "alpine", mfName: "alpineApp", pkg: "@mf-all/app-alpine", label: "Alpine", port: 5180 },
  jquery: { id: "jquery", mfName: "jqueryApp", pkg: "@mf-all/app-jquery", label: "jQuery", port: 5181 },
};

export const APP_IDS = Object.keys(APPS) as AppId[];

type Env = Record<string, string | undefined>;

function env(): Env {
  // vite.config.ts runs in Node; app code runs in the browser.
  return typeof process !== "undefined" && process.env ? process.env : {};
}

/** Origin override, e.g. MF_ORIGIN_REACT=https://react.example.com (build-time). */
export function originFor(id: AppId, e: Env = env()): string {
  return e[`MF_ORIGIN_${id.toUpperCase()}`] ?? `http://localhost:${APPS[id].port}`;
}

/**
 * URL of the remote's MF manifest — the stable deployment contract.
 * The manifest (not remoteEntry.js) is preferred: the runtime resolves the
 * entry + preloadable assets from it, and rollbacks are just repointing it.
 */
export function manifestUrl(id: AppId, e: Env = env()): string {
  return `${originFor(id, e)}/mf-manifest.json`;
}

export interface RemoteEntryConfig {
  name: string;
  entry: string;
  type: "module";
  shareScope: "default";
}

/**
 * The `remotes` map for any host. `self` is included too: every page renders
 * all 7 widgets *through the federation contract*, including its own — proof
 * that widgets are location-independent. Pass `null` to get all apps.
 */
export function remotesFor(
  self: AppId | null,
  e: Env = env(),
): Record<string, RemoteEntryConfig> {
  return Object.fromEntries(
    APP_IDS.map((id) => [
      APPS[id].mfName,
      { name: APPS[id].mfName, entry: manifestUrl(id, e), type: "module", shareScope: "default" },
    ]),
  );
}
