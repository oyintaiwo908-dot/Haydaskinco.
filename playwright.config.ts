import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end suite. The app runs as a production build in MOCK mode (see e2e/server.mjs):
 * Supabase, Paystack and Resend variables are blanked, the build goes to .next-e2e, and a
 * network guard blocks any outbound request from the server. Browser-side, every test fails
 * if the page requests a non-local origin (e2e/fixtures.ts).
 */
const PORT = Number(process.env.E2E_PORT || 3123)
const baseURL = `http://localhost:${PORT}`
// Second server: `next dev` in mock mode with the holding page on (admin UI and holding specs).
const DEV_PORT = Number(process.env.E2E_DEV_PORT || 3124)
const devURL = `http://localhost:${DEV_PORT}`
export const E2E_PREVIEW_KEY = "e2e-preview-key-0001"

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // One local `next start` serves every worker; more than 2 saturates a laptop and only adds timeouts.
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [/nojs\.spec\.ts/, /reduced-motion\.spec\.ts/, /touch\.spec\.ts/, /perf\.spec\.ts/, /\.teardown\.ts/, /dev-mock\//],
      teardown: "network-guard",
    },
    {
      name: "no-js",
      testMatch: /nojs\.spec\.ts/,
      use: { javaScriptEnabled: false, viewport: { width: 390, height: 844 } },
      teardown: "network-guard",
    },
    {
      name: "reduced-motion",
      testMatch: /reduced-motion\.spec\.ts/,
      use: { contextOptions: { reducedMotion: "reduce" } },
      teardown: "network-guard",
    },
    {
      // Real touch input (hasTouch + isMobile, tap()), in Chromium.
      name: "touch",
      testMatch: /touch\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      teardown: "network-guard",
    },
    {
      // Frame-budget tests measure the page, not the laptop: they start after every other
      // project has finished and run one at a time, so no other test competes for the CPU.
      name: "perf",
      testMatch: /perf\.spec\.ts/,
      fullyParallel: false,
      // Tracing records a screencast of every frame, which halves the frame rate it measures.
      use: { trace: "off", screenshot: "off" },
      // Also after dev-mock: the mock `next dev` server is busy (compiling, writing its cache)
      // while those specs run, and that would compete with the measurement.
      dependencies: ["chromium", "no-js", "reduced-motion", "touch", "dev-mock"],
      teardown: "network-guard",
    },
    {
      // Mock `next dev` on DEV_PORT with NEXT_PUBLIC_SITE_HOLDING=1: holding page, preview link,
      // and the admin UI (mock admin sessions exist only outside production builds).
      name: "dev-mock",
      testMatch: /dev-mock\/.*\.spec\.ts/,
      use: { baseURL: devURL },
      timeout: 90_000,
      teardown: "network-guard",
    },
    {
      name: "network-guard",
      testMatch: /network-guard\.teardown\.ts/,
    },
  ],
  webServer: [
    {
      command: "node e2e/server.mjs",
      url: baseURL,
      env: { PORT: String(PORT) },
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: "pipe",
      stderr: "pipe",
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      command: "node e2e/server.mjs",
      url: devURL,
      env: { PORT: String(DEV_PORT), E2E_MODE: "dev", E2E_HOLDING: "1", E2E_PREVIEW_KEY },
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: "pipe",
      stderr: "pipe",
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
})
