import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import { APPS, remotesFor } from "@mf-all/app-registry";

const SELF = APPS.vue;

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
    // Absolute dev URLs so this app's manifest/chunks resolve when another
    // app on a different port federates this one.
    origin: `http://localhost:${SELF.port}`,
    // Federation remotes have full-reload semantics (HMR of consumed modules
    // is not supported by the plugin), and HMR refresh transforms inject
    // page-local preamble dependencies into widget code that must stay
    // evaluatable inside foreign hosts. Off everywhere — on purpose.
    hmr: false,
  },
  preview: { port: SELF.port, strictPort: true },
  // Production builds get absolute asset URLs so peers resolve chunks
  // cross-origin: MF_BUILD_ORIGIN=http://localhost:5173 pnpm build
  base: process.env.MF_BUILD_ORIGIN ?? "/",
  build: { target: "chrome89" },
  plugins: [
    federation({
      name: SELF.mfName,
      filename: "remoteEntry.js",
      manifest: true,
      // Dev speed + stability choice (see README); enable generateTypes in CI.
      dts: false,
      exposes: { "./widget": "./src/widget/mount.ts" },
      // Every app consumes ALL 7 widgets — including its own — through the
      // federation contract. URLs come from the shared registry.
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
        vue: { singleton: true, requiredVersion: "^3.5.0" },
      },
      // In prod builds, bundle the exposed module's CSS into it so remote
      // styling reaches host pages; in dev Vite injects CSS as JS.
      bundleAllCSS: command === "build",
    }),
    vue(),
    tailwindcss(),
    keepOptimizeDepsForceOff(),
  ],
}));
