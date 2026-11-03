import { defineConfig, devices } from '@playwright/test';

// Prüft das laufende Container-Image; Start und Aufräumen übernimmt e2e-image/pruefen.sh.
export default defineConfig({
  testDir: './e2e-image',
  outputDir: './test-results/image',
  forbidOnly: !!process.env['CI'],
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/image', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:18080',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
