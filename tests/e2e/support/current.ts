import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export type CameraMode = 'first-person' | 'follow' | 'orbital';

export interface CurrentDiagnostics {
  cameraMode: CameraMode;
  cameraPosition: readonly [number, number, number];
  cameraTransitioning: boolean;
  day: number;
  digest: string;
  population: number;
  personIds: string[];
  ready: boolean;
  render: {
    calls: number;
    fps: number;
    geometries: number;
    textures: number;
    triangles: number;
  };
  saveStatus: string;
  selected: null | { id: string; kind: 'building' | 'person' | 'vehicle' };
  simulationMillisecondsPerDay: number | null;
  usingWorker: boolean;
}

interface IndexedDbEvidence {
  externalInputs: Array<{ kind: string }>;
  snapshotCount: number;
  worldCount: number;
}

type CurrentWindow = Window & {
  __CURRENT_DIAGNOSTICS__?: CurrentDiagnostics;
  __CURRENT_TEST_API__?: {
    advanceDay: () => void;
    selectFirstPerson: () => string | null;
    setCameraMode: (mode: CameraMode) => void;
  };
};

export async function getDiagnostics(page: Page): Promise<CurrentDiagnostics> {
  return page.evaluate(() => {
    const diagnostics = (window as CurrentWindow).__CURRENT_DIAGNOSTICS__;
    if (diagnostics === undefined) throw new Error('The Current diagnostics are unavailable');
    return diagnostics;
  });
}

export async function waitForReadyWorld(page: Page): Promise<CurrentDiagnostics> {
  await page.waitForFunction(() => {
    const diagnostics = (window as CurrentWindow).__CURRENT_DIAGNOSTICS__;
    return diagnostics?.ready === true &&
      diagnostics.population >= 20 &&
      diagnostics.personIds.length === diagnostics.population;
  });
  return getDiagnostics(page);
}

export async function waitForRenderedWorld(page: Page): Promise<CurrentDiagnostics> {
  await page.waitForFunction(() => {
    const diagnostics = (window as CurrentWindow).__CURRENT_DIAGNOSTICS__;
    return diagnostics?.ready === true &&
      diagnostics.render.calls > 0 &&
      diagnostics.render.geometries > 0 &&
      diagnostics.render.triangles > 0 &&
      diagnostics.render.fps > 0;
  });
  return getDiagnostics(page);
}

export async function enterWorld(page: Page, pause = true): Promise<CurrentDiagnostics> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Witness the current.' })).toBeVisible();
  await expect(page.locator('.world-canvas canvas')).toBeVisible();
  await page.getByRole('button', { name: /Enter as witness/ }).click();
  await expect(page.getByRole('heading', { name: 'Witness the current.' })).toBeHidden();
  const diagnostics = await waitForReadyWorld(page);
  if (pause) await pauseWorld(page);
  return diagnostics;
}

export async function pauseWorld(page: Page): Promise<void> {
  const pauseButton = page.getByRole('button', { name: 'Pause time' });
  const resumeButton = page.getByRole('button', { name: 'Resume time' });
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(resumeButton).toBeVisible();
}

export async function advanceOneDay(page: Page): Promise<CurrentDiagnostics> {
  const before = await getDiagnostics(page);
  await page.evaluate(() => {
    const api = (window as CurrentWindow).__CURRENT_TEST_API__;
    if (api === undefined) throw new Error('The Current test API is unavailable');
    api.advanceDay();
  });
  await page.waitForFunction(
    (day) => ((window as CurrentWindow).__CURRENT_DIAGNOSTICS__?.day ?? -1) >= day,
    before.day + 1,
  );
  return getDiagnostics(page);
}

export async function ensureSaved(page: Page): Promise<CurrentDiagnostics> {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(
    () => (window as CurrentWindow).__CURRENT_DIAGNOSTICS__?.saveStatus === 'saved',
  );
  return getDiagnostics(page);
}

export async function selectFirstPerson(page: Page): Promise<string> {
  const selectedId = await page.evaluate(() => {
    const api = (window as CurrentWindow).__CURRENT_TEST_API__;
    if (api === undefined) throw new Error('The Current test API is unavailable');
    return api.selectFirstPerson();
  });
  expect(selectedId).not.toBeNull();
  if (selectedId === null) throw new Error('The simulation has no selectable person');
  await page.waitForFunction(
    (id) => {
      const selected = (window as CurrentWindow).__CURRENT_DIAGNOSTICS__?.selected;
      return selected?.kind === 'person' && selected.id === id;
    },
    selectedId,
  );
  return selectedId;
}

export async function setCameraMode(page: Page, mode: CameraMode): Promise<void> {
  await page.evaluate((requestedMode) => {
    const api = (window as CurrentWindow).__CURRENT_TEST_API__;
    if (api === undefined) throw new Error('The Current test API is unavailable');
    api.setCameraMode(requestedMode);
  }, mode);
}

export async function waitForSettledCamera(
  page: Page,
  mode: CameraMode,
  previousPosition: readonly [number, number, number],
  minimumMovement = 0.25,
): Promise<CurrentDiagnostics> {
  await page.waitForFunction(
    ({ expectedMode, from, minimumDistance }) => {
      const diagnostics = (window as CurrentWindow).__CURRENT_DIAGNOSTICS__;
      if (
        diagnostics === undefined ||
        diagnostics.cameraMode !== expectedMode ||
        diagnostics.cameraTransitioning
      ) {
        return false;
      }
      const squaredDistance = diagnostics.cameraPosition.reduce((total, value, index) => {
        const previous = from[index] ?? value;
        return total + (value - previous) ** 2;
      }, 0);
      return squaredDistance >= minimumDistance ** 2;
    },
    { expectedMode: mode, from: previousPosition, minimumDistance: minimumMovement },
  );
  return getDiagnostics(page);
}

export async function readIndexedDbEvidence(page: Page): Promise<IndexedDbEvidence> {
  return page.evaluate(async () => {
    function resultOf<T>(request: IDBRequest<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener(
          'error',
          () => reject(request.error ?? new Error('IndexedDB request failed')),
          { once: true },
        );
      });
    }

    const database = await resultOf(indexedDB.open('heartbeat-observatory.the-current'));
    try {
      const transaction = database.transaction(
        ['worlds', 'snapshots', 'external-inputs'],
        'readonly',
      );
      const worldCount = await resultOf(transaction.objectStore('worlds').count());
      const snapshotCount = await resultOf(transaction.objectStore('snapshots').count());
      const externalInputs = await resultOf(
        transaction.objectStore('external-inputs').getAll(),
      ) as Array<{ kind: string }>;
      return { externalInputs, snapshotCount, worldCount };
    } finally {
      database.close();
    }
  });
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

export async function expectLocatorInsideViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box === null || viewport === null) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}
