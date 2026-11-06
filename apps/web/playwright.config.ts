import { defineConfig, devices } from '@playwright/test';

// Emulates phones in Chromium so one browser install is enough: npx playwright install chromium
const phone = (name: string) => { const { defaultBrowserType: _ignored, ...d } = devices[name]; return { ...d, browserName: 'chromium' as const }; };

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'iPhone 13', use: phone('iPhone 13') },
    { name: 'Pixel 7', use: phone('Pixel 7') },
    { name: 'Small phone 320px', use: { browserName: 'chromium', viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'Desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } } },
  ],
});
