import {defineConfig, devices} from '@playwright/test';

// PW_CHROMIUM lets environments with a preinstalled Chromium skip the download.
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: {width: 1440, height: 900},
    launchOptions: {executablePath},
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}}],
  webServer: {
    command: 'npm run build:app && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
