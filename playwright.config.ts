import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the CRM end-to-end tests.
 *
 * The suite runs entirely against the local dev server and stubs every
 * network boundary (Supabase auth, Supabase REST, and TanStack server
 * functions), so it needs no real backend, credentials, or seeded data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
