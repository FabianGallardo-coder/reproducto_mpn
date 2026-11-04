import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5199);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/native/**",
  outputDir: "./test-results/browser",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
    viewport: { width: 1366, height: 768 },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", channel: process.env.PW_CHANNEL },
    },
  ],
});
