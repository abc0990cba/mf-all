import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import { APPS, remotesFor } from "@mf-all/app-registry";

const SELF = APPS.lit;

/**
 * The federation plugin flips `optimizeDeps.force` on, which causes
 * "Outdated Optimize Dep" (504) races on cold dev starts
 * (module-federation/vite#376). Run after the plugin and reset it.
 */
function keepOptimizeDepsForceOff(): Plugin {
  return {
    name: "mf:keep-optimize-deps-force-off",
    enforce: "post",
    config(config) {
      config.optimizeDeps = { ...config.optimizeDeps, force: false };
    },
  };
}

export default defineConfig(({ command }) => ({
  server: {
    port: SELF.port,
    strictPort: true,
    origin: `http://localhost:${SELF.port}`,
    // Federation remotes have full-reload semantics (HMR of consumed modules
    // is not supported by the plugin), and HMR refresh transforms inject
    // page-local preamble dependencies into widget code that must stay
    // evaluatable inside foreign hosts. Off everywhere — on purpose.
    hmr: false,
  },
  preview: { port: SELF.port, strictPort: true },
  base:
    process.env.MF_BUILD_ORIGIN ??
    // Prod builds must reference this app's chunks ABSOLUTELY: every other
    // page consumes them cross-origin (different port), and relative URLs
    // would resolve against the consuming page's origin (404s). Real
    // deployments override with MF_BUILD_ORIGIN (see README).
    (command === "build" ? `http://localhost:${SELF.port}/` : "/"),
  build: { target: "chrome89" },
  plugins: [
    federation({
      name: SELF.mfName,
      filename: "remoteEntry.js",
      manifest: true,
      dts: false,
      exposes: { "./widget": "./src/widget/mount.ts" },
      remotes: remotesFor(null),
      // First-loaded shared instance wins — deterministic singleton
      // negotiation across all 7 apps (official examples use this too).
      shareStrategy: "loaded-first",
      // Official resilience + observability runtime plugins
      // (see src/federation/ for their configuration).
      runtimePlugins: [
        "/src/federation/retry-plugin.ts",
        "/src/federation/observability-plugin.ts",
      ],
      shared: {
        // `lit` is deliberately NOT shared: the page shell and the shadow-DOM
        // widget never interop through lit internals (state flows through the
        // nanostores singleton), so the share-scope negotiation buys nothing
        // here — and a self-contained page is the more robust default.
      },
      // The Lit widget styles itself via shadow-DOM static styles + design
      // tokens — no Tailwind CSS needs to ship with the expose at all.
      bundleAllCSS: command === "build",
    }),
    tailwindcss(),
    keepOptimizeDepsForceOff(),
  ],
}));
