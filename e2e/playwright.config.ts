import { defineConfig, devices } from "@playwright/test";

/**
 * E2E for the 9-way federation mesh. One webServer per app (Playwright
 * starts them in order; all servers must be up before tests run).
 *
 * PLAYWRIGHT_PROD=1 → serve the production builds (`vite preview`) instead
 * of dev servers; run `pnpm build` first (CI does).
 * Locally with servers already running, set PLAYWRIGHT_SKIP_WEBSERVER=1 to
 * attach to them instead of booting new ones.
 */
const MODE = process.env.PLAYWRIGHT_PROD ? "preview" : "dev";
const MANAGERS = process.env.PLAYWRIGHT_SKIP_WEBSERVER
  ? []
  : ([
      ["vue", 5173],
      ["react", 5174],
      ["angular", 5175],
      ["svelte", 5176],
      ["solid", 5177],
      ["preact", 5178],
      ["lit", 5179],
      ["alpine", 5180],
      ["jquery", 5181],
    ] as const).map(([name, port]) => ({
      name: `${MODE}-${name}`,
      command: `pnpm --filter @mf-all/app-${name} ${MODE}`,
      url: `http://localhost:${port}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }));

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  // The dev-mode mesh occasionally needs one reload for a widget whose
  // first load deadlocked; the tests self-heal once and Playwright retries.
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: MANAGERS,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
