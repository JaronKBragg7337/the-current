import { defineConfig, devices } from '@playwright/test';

const localBaseUrl = 'http://127.0.0.1:4179';
const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const baseURL = externalBaseUrl ?? localBaseUrl;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 2 : 0,
  ...(process.env.CI === 'true' ? { workers: 1 } : {}),
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  reporter: process.env.CI === 'true'
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  ...(externalBaseUrl === undefined
    ? {
        webServer: {
          command: 'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort',
          url: localBaseUrl,
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: 'ignore' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
