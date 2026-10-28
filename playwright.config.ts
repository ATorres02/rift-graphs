import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against the static export served the way Cloudflare serves it
 * (`wrangler dev` over ./out). Run `pnpm build` first, or point E2E_BASE_URL at
 * a deployed site.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec wrangler dev --port 8787 --ip 127.0.0.1",
        url: "http://127.0.0.1:8787/",
        reuseExistingServer: true,
        timeout: 60_000,
        // A SIGKILL (the default) leaves wrangler's workerd children running with the output pipe open, and the
        // run never finishes. SIGTERM lets wrangler stop workerd itself.
        gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      },
});
