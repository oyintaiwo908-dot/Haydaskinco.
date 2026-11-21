import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end suite. The app runs as a production build in MOCK mode (see e2e/server.mjs):
 * Supabase, Paystack and Resend variables are blanked, the build goes to .next-e2e, and a
 * network guard blocks any outbound request from the server. Browser-side, every test fails
 * if the page requests a non-local origin (e2e/fixtures.ts).
 */
const PORT = Number(process.env.E2E_PORT || 3123)
const baseURL = `http://localhost:${PORT}`

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
      testIgnore: [/nojs\.spec\.ts/, /reduced-motion\.spec\.ts/, /touch\.spec\.ts/, /perf\.spec\.ts/, /\.teardown\.ts/],
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
      dependencies: ["chromium", "no-js", "reduced-motion", "touch"],
      teardown: "network-guard",
    },
    {
      name: "network-guard",
      testMatch: /network-guard\.teardown\.ts/,
    },
  ],
  webServer: {
    command: "node e2e/server.mjs",
    url: baseURL,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
})
