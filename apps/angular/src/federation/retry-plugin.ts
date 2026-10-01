import { RetryPlugin } from "@module-federation/retry-plugin";

/**
 * Network-layer resilience (official MF retry plugin).
 *
 * Retries remote fetches with linear backoff and a cache-busting query on
 * retry — required for ESM remote entries because browsers cache failed
 * dynamic imports by URL. This also absorbs dev cold-start races (Vite
 * re-optimizing deps while the first page load is in flight).
 */
export default () =>
  RetryPlugin({
    retryTimes: 3,
    retryDelay: (attempt) => 500 * attempt,
    addQuery: true,
  });
