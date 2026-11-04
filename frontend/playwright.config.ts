import { defineConfig, devices } from '@playwright/test'

// End-to-end tests: `npm run e2e`. Playwright starts its own backend (port 8001, fresh
// `aitutor_e2e` database, mock AI and speech; see backend/e2e/server.py) and a Vite server on
// port 5174 that proxies to it, so runs never use real API keys or touch development data.
// Needs Postgres and Redis running (`docker compose up -d`).

const python = process.platform === 'win32' ? '.venv\\Scripts\\python' : '.venv/bin/python'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    launchOptions: {
      // A fake microphone, so voice input can be recorded without hardware or a prompt.
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    {
      command: `${python} -m e2e.server`,
      cwd: '../backend',
      url: 'http://localhost:8001/api/v1/health/ready',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { VITE_API_PROXY_TARGET: 'http://localhost:8001' },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
})
