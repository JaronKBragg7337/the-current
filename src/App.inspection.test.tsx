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
vi.mock('./ui/ExternalSignals', () => ({ ExternalSignals: () => null }));
vi.mock('./ui/LoadingScreen', () => ({ LoadingScreen: () => null }));
vi.mock('./ui/ObserverInterventions', () => ({ ObserverInterventions: () => null }));
vi.mock('./ui/ResourceStrip', () => ({ ResourceStrip: () => null }));
vi.mock('./ui/SelectionPanel', () => ({ SelectionPanel: () => null }));
vi.mock('./ui/SystemPanel', () => ({ SystemPanel: () => null }));
vi.mock('./ui/TopBar', () => ({ TopBar: () => null }));
vi.mock('./ui/WelcomeOverlay', () => ({ WelcomeOverlay: () => null }));
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
});
