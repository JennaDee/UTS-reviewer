import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5173", channel: "chrome", headless: true },
  webServer: {
    command: process.env.UTS_PRODUCTION
      ? "npm run preview -- --port 5173"
      : "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  reporter: "list",
});
