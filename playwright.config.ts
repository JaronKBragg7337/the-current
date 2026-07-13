import { defineConfig, devices } from '@playwright/test';

const localOrigin = 'http://127.0.0.1:4179';
const localBasePath = '/the-current/';
const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const isCi = process.env.CI === 'true';
const baseURL = externalBaseUrl === undefined
  ? `${localOrigin}${localBasePath}`
  : externalBaseUrl.endsWith('/') ? externalBaseUrl : `${externalBaseUrl}/`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/e2e',
  // Each page owns a WebGL renderer and a simulation worker. Running several
  // pages concurrently under SwiftShader can starve the browser event loop and
  // turn persistence assertions into timing failures rather than useful tests.
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  timeout: isCi ? 180_000 : 90_000,
  expect: {
    timeout: isCi ? 60_000 : 30_000,
  },
  reporter: isCi
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
          command: `npm run dev -- --host 127.0.0.1 --port 4179 --strictPort --base=${localBasePath}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: isCi ? 180_000 : 120_000,
          stdout: 'ignore' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
