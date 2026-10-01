import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import { APPS, remotesFor } from "@mf-all/app-registry";

const SELF = APPS.preact;

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
  base: process.env.MF_BUILD_ORIGIN ?? "/",
  build: { target: "chrome89" },
  plugins: [
    federation({
      name: SELF.mfName,
      filename: "remoteEntry.js",
      manifest: true,
      dts: false,
      exposes: { "./widget": "./src/widget/mount.tsx" },
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
      // Preact is a singleton for the Preact-host page. Note this app does
      // NOT use preact/compat — it stays a pure 4 kB runtime, deliberately
      // independent from the React app next door.
      shared: {
        preact: { singleton: true, requiredVersion: "^10.29.0" },
      },
      bundleAllCSS: command === "build",
    }),
    preact(),
    tailwindcss(),
    keepOptimizeDepsForceOff(),
  ],
}));
