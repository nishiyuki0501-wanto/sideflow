import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  use: {
    headless: true,
    viewport: { width: 1200, height: 850 },
    launchOptions: {
      executablePath:
        !process.env.CI && existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined,
    },
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
