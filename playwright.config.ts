import { defineConfig, devices } from '@playwright/test';

// E2E-Tests gegen den Dev-Server. Läuft bereits einer (Run Frontend), wird er wiederverwendet.

// WebKit läuft nur im Playwright-Image (Ubuntu): in der CI und lokal über npm run e2e:webkit, das
// E2E_WEBKIT setzt. Ohne fehlen die Projekte, damit npm run e2e ohne installiertes WebKit läuft.
const mitWebkit = !!process.env['CI'] || !!process.env['E2E_WEBKIT'];

// Auf dem Handy nur die Tests mit Tag @mobil; die übrigen gehen von der Desktop-Ansicht aus.
const mobil = { grep: /@mobil/ };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // JUnit für die Testergebnisse im PR (build.yml).
  reporter: [['html'], ['junit', { outputFile: 'junit/e2e.xml' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, ...mobil },
    ...(mitWebkit
      ? [
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'mobile-safari', use: { ...devices['iPhone 15'] }, ...mobil },
        ]
      : []),
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
  },
});
