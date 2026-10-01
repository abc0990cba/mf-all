import { ObservabilityPlugin } from "@module-federation/observability-plugin";

/**
 * Observability (official MF observability plugin).
 *
 * Records one trace per remote load — manifest, remoteEntry, init, expose,
 * factory, shared phases — and prints a summary to the console. In production,
 * wire `onReport` to navigator.sendBeacon('/api/mf-observability', ...) for
 * error/recovered reports. Inspect traces live via
 * window.__FEDERATION__.__OBSERVABILITY__ in the browser console.
 */
export default () =>
  ObservabilityPlugin({
    level: "summary",
  });
