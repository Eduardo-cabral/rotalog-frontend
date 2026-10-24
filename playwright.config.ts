import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    use: { baseURL: "http://127.0.0.1:5174", channel: "msedge", headless: true },
    webServer: { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort", url: "http://127.0.0.1:5174", reuseExistingServer: false, env: { VITE_AUTH_MODE: process.env.VITE_AUTH_MODE ?? "mock" } },
});
