import { defineConfig, devices } from "@playwright/test"

/**
 * Customer and admin journeys, end to end, in a real browser (docs/user-journeys.md).
 *
 * Runs against a storefront and backend that are ALREADY running — CI starts
 * them from an empty database in .github/workflows/ci.yml (job `e2e`); locally,
 * start both and point these at them:
 *
 *   E2E_BASE_URL          storefront, default http://localhost:8000
 *   E2E_BACKEND_URL       Medusa, default http://localhost:9000
 *   E2E_PUBLISHABLE_KEY   to read back the cart a journey created
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   admin journeys; skipped without them
 *
 * Phone-sized by default, because that is who books (CLAUDE.md, mobile-first).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // Journeys share one backend and one small fleet (a car is sold once per slot).
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Locally there is no Playwright browser download; use the installed Chrome.
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } }, testMatch: /site\.spec\.ts/ },
  ],
})
