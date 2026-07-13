import { chromium, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type CameraMode = 'first-person' | 'follow' | 'orbital';

interface Diagnostics {
  cameraMode: CameraMode;
  cameraTransitioning: boolean;
  day: number;
  population: number;
  render: {
    calls: number;
    fps: number;
    geometries: number;
    textures: number;
    triangles: number;
  };
  selected: null | { id: string; kind: string };
}

interface CurrentWindow {
  __CURRENT_DIAGNOSTICS__?: Diagnostics;
  __CURRENT_TEST_API__?: {
    selectFirstPerson: () => string | null;
    selectEvidencePerson: () => string | null;
    setCameraMode: (mode: CameraMode) => void;
  };
}

const outputDirectory = resolve('docs/screenshots/visual-pass');
const viewerUrl = process.argv[2] ?? process.env.CURRENT_EVIDENCE_URL ?? 'http://127.0.0.1:4179/the-current/';

async function enterWorld(page: Page): Promise<void> {
  await page.goto(viewerUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (globalThis as unknown as CurrentWindow).__CURRENT_DIAGNOSTICS__?.render.fps !== undefined);
  await page.getByRole('button', { name: /Enter as witness/ }).click();
  const pause = page.getByRole('button', { name: 'Pause time' });
  if (await pause.isVisible()) await pause.click();
  // Let shader compilation and adaptive DPR settle before sampling. The
  // diagnostic is still a software-Chromium observation, not a device claim.
  await page.waitForTimeout(4_000);
}

async function diagnostics(page: Page): Promise<Diagnostics> {
  return page.evaluate(() => {
    const value = (globalThis as unknown as CurrentWindow).__CURRENT_DIAGNOSTICS__;
    if (value === undefined) throw new Error('Renderer diagnostics are unavailable');
    return value;
  });
}

async function setMode(page: Page, mode: CameraMode): Promise<void> {
  await page.evaluate(() => {
    const api = (globalThis as unknown as CurrentWindow).__CURRENT_TEST_API__;
    if (api === undefined) throw new Error('Test camera API is unavailable');
    if ((globalThis as unknown as CurrentWindow).__CURRENT_DIAGNOSTICS__?.selected === null) api.selectEvidencePerson();
  });
  await page.waitForFunction(() => (globalThis as unknown as CurrentWindow).__CURRENT_DIAGNOSTICS__?.selected?.kind === 'person');
  await page.evaluate((requestedMode) => {
    const api = (globalThis as unknown as CurrentWindow).__CURRENT_TEST_API__;
    if (api === undefined) throw new Error('Test camera API is unavailable');
    api.setCameraMode(requestedMode);
  }, mode);
  await page.waitForFunction((requestedMode) => {
    const current = (globalThis as unknown as CurrentWindow).__CURRENT_DIAGNOSTICS__;
    return current?.cameraMode === requestedMode && !current.cameraTransitioning;
  }, mode);
  await page.waitForTimeout(2_000);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const measurements: Record<string, Diagnostics> = {};

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await desktop.newPage();
  await enterWorld(page);
  measurements.desktopOrbital = await diagnostics(page);
  await page.screenshot({ path: resolve(outputDirectory, 'after-local-desktop-orbit.png') });

  await setMode(page, 'follow');
  measurements.desktopFollow = await diagnostics(page);
  await page.screenshot({ path: resolve(outputDirectory, 'after-local-third-person-follow.png') });

  await setMode(page, 'first-person');
  measurements.desktopFirstPerson = await diagnostics(page);
  await page.screenshot({ path: resolve(outputDirectory, 'after-local-first-person.png') });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' });
  const mobilePage = await mobile.newPage();
  await enterWorld(mobilePage);
  measurements.mobileOrbital = await diagnostics(mobilePage);
  await mobilePage.screenshot({ path: resolve(outputDirectory, 'after-local-mobile-orbit.png') });
  await mobile.close();
} finally {
  await browser.close();
}

await writeFile(
  resolve(outputDirectory, 'performance-local.json'),
  `${JSON.stringify({ capturedAt: new Date().toISOString(), url: viewerUrl, measurements }, null, 2)}\n`,
  'utf8',
);

console.log(`Visual evidence written to ${outputDirectory}`);
