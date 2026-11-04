import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/native",
  outputDir: "./test-results/native",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/native", open: "never" }]],
});
