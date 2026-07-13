import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

import {
  advanceOneDay,
  ensureSaved,
  enterWorld,
  expectLocatorInsideViewport,
  expectNoHorizontalOverflow,
  getDiagnostics,
  readIndexedDbEvidence,
  readPersistedEventTypes,
  readPersistedExternalInputs,
  selectFirstPerson,
  setCameraMode,
  waitForReadyWorld,
  waitForRenderedWorld,
  waitForSettledCamera,
} from './support/current';

async function activateVisibleButton(
  button: Locator,
): Promise<void> {
  await expect(button).toBeVisible();
  // Sticky close buttons can keep Playwright's pointer-action stability loop
  // alive under software WebGL. Visibility is asserted first; dispatching the
  // DOM click then verifies the same accessible button and React handler.
  await button.dispatchEvent('click');
}

test('loads the configured base path in a worker-backed WebGL world and advances a day', async ({ page, baseURL }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await enterWorld(page);
  expect(baseURL).toBeDefined();
  if (baseURL !== undefined) {
    expect(new URL(page.url()).pathname).toBe(new URL(baseURL).pathname);
  }
  const initial = await waitForRenderedWorld(page);
  const canvas = page.locator('.world-canvas canvas');
  const webglContext = await canvas.evaluate((element) => {
    const surface = element as HTMLCanvasElement;
    if (surface.getContext('webgl2') !== null) return 'webgl2';
    if (surface.getContext('webgl') !== null) return 'webgl';
    return null;
  });

  expect(webglContext).not.toBeNull();
  expect(initial.usingWorker).toBe(true);
  expect(initial.population).toBeGreaterThanOrEqual(20);
  expect(initial.personIds).toHaveLength(initial.population);
  expect(initial.render.calls).toBeGreaterThan(0);
  expect(initial.render.triangles).toBeGreaterThan(0);

  const advanced = await advanceOneDay(page);
  expect(advanced.day).toBeGreaterThanOrEqual(initial.day + 1);
  expect(advanced.digest).not.toBe(initial.digest);
  expect(pageErrors).toEqual([]);
});

test('desktop keyboard controls change speed and pause without controlling an NPC', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop keyboard controls');
  await enterWorld(page);

  const speed = page.getByLabel('World speed');
  await expect(speed).toHaveValue('1');
  await page.keyboard.press(']');
  await expect(speed).toHaveValue('4');
  await expect(page.getByRole('button', { name: 'Pause time' })).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Resume time' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause time' })).toBeVisible();

  await page.keyboard.press('[');
  await expect(speed).toHaveValue('1');
});

test('desktop panels open, expose diagnostics, and close accessibly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop panel controls');
  await enterWorld(page);

  await page.getByRole('button', { name: 'History', exact: true }).click();
  const historyPanel = page.getByRole('complementary', { name: 'Recent world history' });
  await expect(historyPanel).toBeVisible();
  await activateVisibleButton(page.getByRole('button', { name: 'Close history' }));
  await expect(historyPanel).toBeHidden();

  await page.getByRole('button', { name: 'Influence', exact: true }).click();
  const interventionPanel = page.getByRole('complementary', { name: 'Observer interventions' });
  await expect(interventionPanel).toBeVisible();
  await activateVisibleButton(page.getByRole('button', { name: 'Close interventions' }));
  await expect(interventionPanel).toBeHidden();

  await page.getByRole('button', { name: 'System', exact: true }).click();
  const diagnosticsPanel = page.getByRole('complementary', {
    name: 'Simulation and renderer diagnostics',
  });
  await expect(diagnosticsPanel).toBeVisible();
  await expect(diagnosticsPanel.getByText('Draw calls')).toBeVisible();
  await expect(diagnosticsPanel.getByText('State digest')).toBeVisible();
  await activateVisibleButton(page.getByRole('button', { name: 'Close diagnostics' }));
  await expect(diagnosticsPanel).toBeHidden();
});

test('bundled external signals load without third-party requests and enter history as pressure', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Signals panel is desktop-only');
  const thirdPartyRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      thirdPartyRequests.push(request.url());
    }
  });

  const fixtureResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/data/signals.v1.json'),
  );
  await enterWorld(page);
  await page.getByRole('button', { name: 'Signals', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'External signals' })).toBeVisible();
  expect((await fixtureResponse).status()).toBe(200);

  const signalChoices = page.getByRole('radio');
  await expect(signalChoices.first()).toBeVisible();
  await signalChoices.last().check();
  await expect(page.getByRole('heading', { name: 'Objective pressure' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Belief pressure' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence and lineage' })).toBeVisible();
  await page.getByRole('button', { name: 'Queue selected signal' }).click();
  await expect(page.getByRole('button', { name: 'Signal queued' })).toBeVisible();
  await expect(page.getByText(/queued for world day .* pressure, not a scripted outcome/i)).toBeVisible();

  const persistedInputs = await readPersistedExternalInputs(page);
  expect(persistedInputs.some((input) => input.kind === 'signal')).toBe(true);
  await activateVisibleButton(page.getByRole('button', { name: 'Close outside signals' }));
  await expect(page.getByRole('heading', { name: 'External signals' })).toBeHidden();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('signal received', { exact: true })).toBeVisible();
  expect(thirdPartyRequests).toEqual([]);
});

test('observer help is persisted, resolved causally, and recorded in history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Influence panel is hidden on mobile');
  await enterWorld(page);

  await page.getByRole('button', { name: 'Influence', exact: true }).click();
  const foodShipment = page.getByRole('article').filter({ hasText: 'Food shipment' });
  await foodShipment.getByRole('button', { name: 'Spend 3 energy' }).click();
  await expect(foodShipment.getByRole('button', { name: 'Queueing…' })).toBeVisible();
  await expect(
    page.getByText(/Food shipment queued for world day .* Residents retain agency/i),
  ).toBeVisible();

  const persistedInputs = await readPersistedExternalInputs(page);
  expect(persistedInputs.some((input) => input.kind === 'intervention')).toBe(true);
  await advanceOneDay(page);
  await expect.poll(
    async () => (await readPersistedEventTypes(page)).includes('intervention-resolved'),
    { timeout: 30_000 },
  ).toBe(true);
});

test('NPC selection supports settled orbital, follow, and first-person spectator transitions', async ({ page }) => {
  const orbital = await enterWorld(page);
  const personId = await selectFirstPerson(page);
  expect((await getDiagnostics(page)).selected).toEqual({ kind: 'person', id: personId });

  await setCameraMode(page, 'follow');
  const follow = await waitForSettledCamera(page, 'follow', orbital.cameraPosition);
  expect(follow.cameraMode).toBe('follow');
  expect(follow.selected).toEqual({ kind: 'person', id: personId });

  await setCameraMode(page, 'first-person');
  const firstPerson = await waitForSettledCamera(page, 'first-person', follow.cameraPosition);
  expect(firstPerson.cameraMode).toBe('first-person');
  expect(firstPerson.selected).toEqual({ kind: 'person', id: personId });

  await page.keyboard.press('1');
  const returnedOrbit = await waitForSettledCamera(page, 'orbital', firstPerson.cameraPosition);
  expect(returnedOrbit.selected).toEqual({ kind: 'person', id: personId });
  expect(returnedOrbit.cameraTransitioning).toBe(false);
});

test('manual save restores the same deterministic IndexedDB snapshot after reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Persistence is covered once on Chromium');
  await enterWorld(page);
  await advanceOneDay(page);
  const saved = await ensureSaved(page);
  const beforeReload = await readIndexedDbEvidence(page);
  expect(beforeReload.worldCount).toBe(1);
  expect(beforeReload.snapshotCount).toBeGreaterThanOrEqual(1);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Witness the current.' })).toBeVisible();
  const restored = await waitForReadyWorld(page);
  expect(restored.day).toBe(saved.day);
  expect(restored.digest).toBe(saved.digest);
  expect(restored.population).toBe(saved.population);
});

test('mobile Chromium keeps the world and spectator controls inside the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile responsive coverage');
  await enterWorld(page);

  await expectNoHorizontalOverflow(page);
  await expectLocatorInsideViewport(page, page.locator('.world-canvas canvas'));
  await expectLocatorInsideViewport(page, page.getByRole('navigation', { name: 'Spectator camera' }));
  await expectLocatorInsideViewport(page, page.locator('header.top-bar'));
  await expect(page.getByRole('button', { name: 'Signals', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Follow' })).toBeDisabled();
});
