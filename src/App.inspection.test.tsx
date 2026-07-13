// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimulationRuntimeView } from './app/useSimulationRuntime';
import { useSimulationRuntime } from './app/useSimulationRuntime';
import type { PersonProjection, WorldProjection } from './simulation';
import { App } from './App';

vi.mock('./app/useSimulationRuntime', () => ({ useSimulationRuntime: vi.fn() }));
vi.mock('./ui/CameraDock', () => ({ CameraDock: () => null }));
vi.mock('./ui/EventTimeline', () => ({ EventTimeline: () => null }));
vi.mock('./ui/ExternalSignals', async () => {
  const { useState } = await import('react');
  return {
    ExternalSignals: () => {
      const [count, setCount] = useState(0);
      return (
        <button type="button" data-testid="signals-state" onClick={() => setCount((value) => value + 1)}>
          signals state {count}
        </button>
      );
    },
  };
});
vi.mock('./ui/LoadingScreen', () => ({ LoadingScreen: () => null }));
vi.mock('./ui/ObserverInterventions', async () => {
  const { useState } = await import('react');
  return {
    ObserverInterventions: () => {
      const [count, setCount] = useState(0);
      return (
        <button type="button" data-testid="interventions-state" onClick={() => setCount((value) => value + 1)}>
          interventions state {count}
        </button>
      );
    },
  };
});
vi.mock('./ui/ResourceStrip', () => ({ ResourceStrip: () => null }));
vi.mock('./ui/SelectionPanel', () => ({ SelectionPanel: () => null }));
vi.mock('./ui/SystemPanel', () => ({ SystemPanel: () => null }));
vi.mock('./ui/TopBar', () => ({
  TopBar: ({ onTogglePanel }: { onTogglePanel: (panel: 'interventions' | 'signals') => void }) => (
    <nav>
      <button type="button" data-testid="toggle-signals" onClick={() => onTogglePanel('signals')}>Signals</button>
      <button type="button" data-testid="toggle-interventions" onClick={() => onTogglePanel('interventions')}>Interventions</button>
    </nav>
  ),
}));
vi.mock('./ui/WelcomeOverlay', () => ({
  WelcomeOverlay: ({ onEnter }: { onEnter: () => void }) => (
    <button type="button" data-testid="enter-world" onClick={onEnter}>Enter</button>
  ),
}));
vi.mock('./world/WorldCanvas', () => ({ WorldCanvas: () => null }));

const PERSON: PersonProjection = {
  id: 'person-1',
  name: 'Ada Current',
  position: { x: 0, y: 0, z: 0 },
  destination: { x: 1, y: 0, z: 0 },
  yaw: 0,
  heightMeters: 1.7,
  lifeStage: 'adult',
  biologicalSex: 'female',
  occupation: 'researcher',
  task: 'work',
  health: 100,
  emotion: 0,
  householdId: null,
  homeBuildingId: null,
  partnerId: null,
  decisionReason: 'Testing a hypothesis.',
  rareEvidence: 35,
};

function projection(day: number): WorldProjection {
  return {
    schemaVersion: 1,
    day,
    tick: day,
    settlementId: 'settlement-1',
    settlementName: 'Confluence',
    population: 1,
    people: [PERSON],
    buildings: [],
    resources: { energy: 10, food: 10, medicine: 10, stone: 10, tools: 10, transport: 10, water: 10, wood: 10 },
    prices: { energy: 1, food: 1, medicine: 1, stone: 1, tools: 1, transport: 1, water: 1, wood: 1 },
    pressure: {} as WorldProjection['pressure'],
    recentEvents: [],
    metrics: {} as WorldProjection['metrics'],
    digest: `day-${day}`,
  } as WorldProjection;
}

describe('selected person inspection refresh', () => {
  let container: HTMLDivElement;
  let root: Root;
  let runtime: SimulationRuntimeView;
  const inspectPerson = vi.fn();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    inspectPerson.mockReset();
    runtime = {
      projection: projection(0),
      inspectedPerson: null,
      inspectedPersonId: null,
      hostMetrics: null,
      ready: true,
      paused: true,
      speed: 1,
      saveStatus: 'saved',
      error: null,
      usingWorker: true,
      setSpeed: vi.fn(),
      togglePause: vi.fn(),
      advanceDays: vi.fn(),
      inspectPerson,
      submitIntervention: vi.fn(),
      submitSignal: vi.fn(),
      saveNow: vi.fn(),
      exportWorld: vi.fn(),
      importWorld: vi.fn(),
    };
    vi.mocked(useSimulationRuntime).mockReturnValue(runtime);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete window.__CURRENT_TEST_API__;
  });

  it('requests fresh authoritative details on every new projection day', async () => {
    await act(async () => root.render(<App />));
    await act(async () => {
      window.__CURRENT_TEST_API__?.selectFirstPerson();
    });
    expect(inspectPerson).toHaveBeenLastCalledWith(PERSON.id);

    inspectPerson.mockClear();
    runtime = { ...runtime, projection: projection(1) };
    vi.mocked(useSimulationRuntime).mockReturnValue(runtime);
    await act(async () => root.render(<App />));

    expect(inspectPerson).toHaveBeenCalledTimes(1);
    expect(inspectPerson).toHaveBeenCalledWith(PERSON.id);
  });

  it('preserves signal and intervention state across panel close and interface hiding', async () => {
    await act(async () => root.render(<App />));

    const signalsState = container.querySelector<HTMLButtonElement>('[data-testid="signals-state"]');
    const interventionsState = container.querySelector<HTMLButtonElement>('[data-testid="interventions-state"]');
    expect(signalsState).not.toBeNull();
    expect(interventionsState).not.toBeNull();

    await act(async () => {
      signalsState?.click();
      interventionsState?.click();
      container.querySelector<HTMLButtonElement>('[data-testid="toggle-signals"]')?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Close outside signals"]')?.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="toggle-signals"]')?.click();
    });

    expect(container.querySelector('[data-testid="signals-state"]')?.textContent).toContain('1');
    expect(container.querySelector('[data-testid="interventions-state"]')?.textContent).toContain('1');
  });

  it('dismisses the welcome overlay without starting the paused simulation', async () => {
    await act(async () => root.render(<App />));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="enter-world"]')?.click();
    });

    expect(container.querySelector('[data-testid="enter-world"]')).toBeNull();
    expect(runtime.setSpeed).not.toHaveBeenCalled();
    expect(runtime.togglePause).not.toHaveBeenCalled();
  });

  it('rejects oversized imports visibly without reading them and always resets the input', async () => {
    await act(async () => root.render(<App />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    if (input === null) return;

    const text = vi.fn(async () => '{}');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ size: Number.MAX_SAFE_INTEGER, text }],
    });
    Object.defineProperty(input, 'value', {
      configurable: true,
      value: 'oversized.current.json',
      writable: true,
    });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(text).not.toHaveBeenCalled();
    expect(runtime.importWorld).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('128 MB import limit');
    expect(input.value).toBe('');
  });

  it('surfaces import failures and resets the input so the same file can be retried', async () => {
    vi.mocked(runtime.importWorld).mockRejectedValueOnce(new Error('Snapshot digest mismatch'));
    await act(async () => root.render(<App />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    if (input === null) return;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ size: 128, text: async () => '{"world":{}}' }],
    });
    Object.defineProperty(input, 'value', {
      configurable: true,
      value: 'invalid.current.json',
      writable: true,
    });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(runtime.importWorld).toHaveBeenCalledWith('{"world":{}}');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Snapshot digest mismatch');
    expect(input.value).toBe('');
  });
});
