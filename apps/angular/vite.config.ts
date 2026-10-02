import { defineConfig, type Plugin } from "vite";
import angular from "@analogjs/vite-plugin-angular";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import { APPS, remotesFor } from "@mf-all/app-registry";

const SELF = APPS.angular;

/**
 * The federation plugin flips `optimizeDeps.force` on, which causes
 * "Outdated Optimize Dep" (504) races on cold dev starts
 * (module-federation/vite#376). Run after the plugin and reset it — same
 * workaround as the official module-federation-vite-angular example.
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
  resolve: {
    // Same as the official Angular federation example.
    mainFields: ["module"],
    dedupe: ["@angular/core"],
  },
  // Analog switches Vite's esbuild transpiler off (its Angular compiler
  // emits JS for the files in its program). Decorator-less TS files that
  // fall outside that emit need esbuild — enable it for all TS: Analog's
  // own emit overrides esbuild's output for Angular-compiled files.
  esbuild: {
    include: /\.(ts|tsx)$/,
  },
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
        "@angular/core": { singleton: true, requiredVersion: "^21.0.0" },
        rxjs: { singleton: true, requiredVersion: "^7.8.0" },
        tslib: { singleton: true, requiredVersion: "^2.8.0" },
      },
      // Angular component styles are compiled into the component bundle
      // (emulated encapsulation), so the widget's CSS travels with its JS.
      bundleAllCSS: command === "build",
    }),
    // Analog compiles Angular (Ivy) during the Vite build — zoneless, so no
    // zone.js anywhere in this app.
    //
    // transformFilter keeps the Angular compiler away from workspace packages
    // (@mf-all/* imported via /@fs/): files outside its program would get an
    // empty emit in production builds. Vite's esbuild (enabled above)
    // transpiles those instead.
    angular({
      transformFilter: (_code, id) => !id.includes("/packages/"),
    }),
    tailwindcss(),
    keepOptimizeDepsForceOff(),
  ],
}));
