import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CameraMode, EnvironmentOverlayMetric, Selection } from './app/types';
import { useWorldRuntime, type WorldRuntime } from './app/sharedWorldRuntime';
import { BUILDING_FOOTPRINTS } from './simulation';
import { CameraDock } from './ui/CameraDock';
import { EventTimeline } from './ui/EventTimeline';
import { ExternalSignals } from './ui/ExternalSignals';
import { LoadingScreen } from './ui/LoadingScreen';
import { ObserverInterventions } from './ui/ObserverInterventions';
import { ResourceStrip } from './ui/ResourceStrip';
import { SelectionPanel } from './ui/SelectionPanel';
import { SystemPanel } from './ui/SystemPanel';
import { TopBar } from './ui/TopBar';
import { WelcomeOverlay } from './ui/WelcomeOverlay';
import type { RenderDiagnostics } from './world/DiagnosticsBridge';
import type { CameraDiagnostics } from './world/SpectatorCamera';
import { deriveVehicles } from './world/vehicles';
import { WorldCanvas } from './world/WorldCanvas';

const SPEEDS = [0.25, 1, 4, 16, 64] as const;
const EMPTY_RENDER_DIAGNOSTICS: RenderDiagnostics = {
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  fps: 0,
};
const MAX_IMPORT_FILE_BYTES = 128 * 1024 * 1024;

type PanelKey = 'history' | 'interventions' | 'metrics' | 'signals';
type PanelState = Record<PanelKey, boolean>;

declare global {
  interface Window {
    __CURRENT_DIAGNOSTICS__?: {
      cameraMode: CameraMode;
      cameraPosition: readonly [number, number, number];
      cameraTransitioning: boolean;
      day: number;
      digest: string;
      environmentOverlay: EnvironmentOverlayMetric | null;
      population: number;
      personIds: string[];
      ready: boolean;
      render: RenderDiagnostics;
      saveStatus: string;
      selected: Selection;
      simulationMillisecondsPerDay: number | null;
      usingWorker: boolean;
    };
    __CURRENT_TEST_API__?: {
      advanceDay: () => void;
      selectEvidencePerson: () => string | null;
      selectFirstPerson: () => string | null;
      setCameraMode: (mode: CameraMode) => void;
    };
  }
}

export function App() {
  const runtime = useWorldRuntime();
  if (runtime === null) return <LoadingScreen error={null} />;
  return <AppView runtime={runtime} />;
}

function AppView({ runtime }: { runtime: WorldRuntime }) {
  const inspectPerson = runtime.inspectPerson;
  const setSimulationSpeed = runtime.setSpeed;
  const toggleSimulationPause = runtime.togglePause;
  const importWorld = runtime.importWorld;
  const advanceSimulationDays = runtime.advanceDays;
  const [selection, setSelection] = useState<Selection>(null);
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbital');
  const [panels, setPanels] = useState<PanelState>({
    history: false,
    interventions: false,
    metrics: false,
    signals: false,
  });
  const [interfaceHidden, setInterfaceHidden] = useState(false);
  const [environmentOverlay, setEnvironmentOverlay] = useState<EnvironmentOverlayMetric | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [renderDiagnostics, setRenderDiagnostics] = useState(EMPTY_RENDER_DIAGNOSTICS);
  const [cameraDiagnostics, setCameraDiagnostics] = useState<CameraDiagnostics>({
    position: [96, 76, 96],
    transitioning: false,
  });
  const importInputRef = useRef<HTMLInputElement>(null);
  const projection = runtime.projection;
  const projectionDay = projection?.day;
  const vehicles = useMemo(() => projection === null ? [] : deriveVehicles(projection), [projection]);
  const selectedPerson = projection !== null && selection?.kind === 'person'
    ? projection.people.find((person) => person.id === selection.id) ?? null
    : null;
  const selectedBuilding = projection !== null && selection?.kind === 'building'
    ? projection.buildings.find((building) => building.id === selection.id) ?? null
    : null;
  const selectedVehicle = selection?.kind === 'vehicle'
    ? vehicles.find((vehicle) => vehicle.id === selection.id) ?? null
    : null;

  useEffect(() => {
    if (projectionDay !== undefined && selection?.kind === 'person') inspectPerson(selection.id);
  }, [inspectPerson, projectionDay, selection]);

  useEffect(() => {
    if (projection === null || selection === null) return;
    const stillExists = selection.kind === 'person'
      ? projection.people.some((person) => person.id === selection.id)
      : selection.kind === 'building'
        ? projection.buildings.some((building) => building.id === selection.id)
        : vehicles.some((vehicle) => vehicle.id === selection.id);
    if (!stillExists) {
      setSelection(null);
      setSelectionPanelOpen(false);
      setCameraMode('orbital');
    }
  }, [projection, selection, vehicles]);

  const handleCameraMode = useCallback((mode: CameraMode): void => {
    if ((mode === 'follow' || mode === 'first-person') && selection?.kind !== 'person') return;
    setCameraMode(mode);
    if (mode === 'follow' || mode === 'first-person') setSelectionPanelOpen(false);
  }, [selection]);

  const handleSelection = useCallback((nextSelection: Selection): void => {
    if (nextSelection === null && cameraMode !== 'orbital') {
      setSelectionPanelOpen(false);
      return;
    }
    setSelection(nextSelection);
    setSelectionPanelOpen(nextSelection !== null);
  }, [cameraMode]);

  const changeSpeedStep = useCallback((direction: -1 | 1): void => {
    const currentIndex = SPEEDS.findIndex((value) => value === runtime.speed);
    const start = currentIndex === -1 ? 1 : currentIndex;
    const next = Math.max(0, Math.min(SPEEDS.length - 1, start + direction));
    setSimulationSpeed(SPEEDS[next] ?? 1);
  }, [runtime.speed, setSimulationSpeed]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
      switch (event.key.toLowerCase()) {
        case '1':
          setCameraMode('orbital');
          break;
        case '2':
          if (selection?.kind === 'person') setCameraMode('follow');
          break;
        case '3':
          if (selection?.kind === 'person') setCameraMode('first-person');
          break;
        case ' ':
          event.preventDefault();
          toggleSimulationPause();
          break;
        case '[':
          changeSpeedStep(-1);
          break;
        case ']':
          changeSpeedStep(1);
          break;
        case 'h':
          setInterfaceHidden((hidden) => !hidden);
          break;
        case 'escape':
          if (selectionPanelOpen) {
            setSelectionPanelOpen(false);
          } else if (selection !== null && cameraMode === 'orbital') {
            setSelection(null);
          } else {
            setPanels({ history: false, interventions: false, metrics: false, signals: false });
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [cameraMode, changeSpeedStep, selection, selectionPanelOpen, toggleSimulationPause]);

  useEffect(() => {
    if (projection === null) return;
    window.__CURRENT_DIAGNOSTICS__ = {
      cameraMode,
      cameraPosition: cameraDiagnostics.position,
      cameraTransitioning: cameraDiagnostics.transitioning,
      day: projection.day,
      digest: projection.digest,
      environmentOverlay,
      population: projection.population,
      personIds: projection.people.map((person) => person.id),
      ready: runtime.ready,
      render: renderDiagnostics,
      saveStatus: runtime.saveStatus,
      selected: selection,
      simulationMillisecondsPerDay: runtime.hostMetrics?.averageMillisecondsPerDay ?? null,
      usingWorker: runtime.usingWorker,
    };
  }, [cameraDiagnostics, cameraMode, environmentOverlay, projection, renderDiagnostics, runtime.hostMetrics, runtime.ready, runtime.saveStatus, runtime.usingWorker, selection]);

  useEffect(() => {
    if (projection === null) return;
    window.__CURRENT_TEST_API__ = {
      advanceDay: () => advanceSimulationDays(1),
      selectEvidencePerson: () => {
        const person = projection.people.reduce<(typeof projection.people)[number] | null>((best, candidate) => {
          const clearance = (x: number, z: number) => projection.buildings.reduce((nearest, building) => {
            if (building.type === 'road') return nearest;
            const footprint = BUILDING_FOOTPRINTS[building.type];
            const edgeDistance = Math.hypot(x - building.position.x, z - building.position.z)
              - Math.hypot(footprint.width, footprint.depth) / 2;
            return Math.min(nearest, edgeDistance);
          }, Number.POSITIVE_INFINITY);
          if (best === null) return candidate;
          return clearance(candidate.position.x, candidate.position.z)
            > clearance(best.position.x, best.position.z) ? candidate : best;
        }, null);
        if (person === null) return null;
        setSelection({ kind: 'person', id: person.id });
        setSelectionPanelOpen(true);
        return person.id;
      },
      selectFirstPerson: () => {
        const person = projection.people[0];
        if (person === undefined) return null;
        setSelection({ kind: 'person', id: person.id });
        setSelectionPanelOpen(true);
        return person.id;
      },
      setCameraMode: (mode) => handleCameraMode(mode),
    };
    return () => {
      delete window.__CURRENT_TEST_API__;
    };
  }, [advanceSimulationDays, handleCameraMode, projection]);

  const handleDiagnostics = useCallback((diagnostics: RenderDiagnostics): void => {
    setRenderDiagnostics(diagnostics);
  }, []);

  const togglePanel = useCallback((panel: PanelKey): void => {
    setPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }, []);

  const jumpToEntity = useCallback((entityId: string): void => {
    if (projection === null) return;
    if (projection.people.some((person) => person.id === entityId)) {
      setSelection({ kind: 'person', id: entityId });
    } else if (projection.buildings.some((building) => building.id === entityId)) {
      setSelection({ kind: 'building', id: entityId });
    } else if (vehicles.some((vehicle) => vehicle.id === entityId)) {
      setSelection({ kind: 'vehicle', id: entityId });
    }
    setSelectionPanelOpen(true);
  }, [projection, vehicles]);

  const handleImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setImportError(null);

    try {
      if (file === undefined) return;
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        throw new Error('The selected file exceeds the 128 MB import limit.');
      }

      await importWorld(await file.text());
      setSelection(null);
      setSelectionPanelOpen(false);
      setCameraMode('orbital');
    } catch (error) {
      const detail = error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'The selected file could not be read or restored.';
      setImportError(`World import failed: ${detail}`);
    } finally {
      input.value = '';
    }
  }, [importWorld]);

  if (projection === null) return <LoadingScreen error={runtime.error} />;

  return (
    <main className={interfaceHidden ? 'app-shell interface-hidden' : 'app-shell'}>
      <WorldCanvas
        projection={projection}
        vehicles={vehicles}
        selection={selection}
        cameraMode={cameraMode}
        environmentOverlay={interfaceHidden ? null : environmentOverlay}
        onSelect={handleSelection}
        onCameraModeChange={handleCameraMode}
        onCameraDiagnostics={setCameraDiagnostics}
        onDiagnostics={handleDiagnostics}
      />

      <div className="vignette" aria-hidden="true" />
      {!interfaceHidden && (
        <>
          <TopBar
            day={projection.day}
            population={projection.population}
            settlementName={projection.settlementName}
            cameraMode={cameraMode}
            paused={runtime.paused}
            speed={runtime.speed}
            saveStatus={runtime.saveStatus}
            usingWorker={runtime.usingWorker}
            liveWorld={runtime.liveWorld}
            environmentOverlay={environmentOverlay}
            panelsOpen={panels}
            onTogglePause={runtime.togglePause}
            onSpeedChange={runtime.setSpeed}
            onAdvanceDay={() => runtime.advanceDays(1)}
            onSave={runtime.saveNow}
            onExport={runtime.exportWorld}
            onImport={() => importInputRef.current?.click()}
            onEnvironmentOverlayChange={setEnvironmentOverlay}
            onTogglePanel={togglePanel}
          />
          <ResourceStrip resources={projection.resources} metrics={projection.metrics} />
          <SelectionPanel
            selection={selectionPanelOpen ? selection : null}
            person={selectedPerson}
            building={selectedBuilding}
            vehicle={selectedVehicle}
            inspectedPerson={runtime.inspectedPersonId === selectedPerson?.id ? runtime.inspectedPerson : null}
            events={projection.recentEvents}
            cameraMode={cameraMode}
            onCameraModeChange={handleCameraMode}
            onClose={() => setSelectionPanelOpen(false)}
          />
          {panels.history && (
            <EventTimeline
              events={projection.recentEvents}
              onClose={() => togglePanel('history')}
              onJumpTo={jumpToEntity}
            />
          )}
          {panels.metrics && (
            <SystemPanel
              metrics={projection.metrics}
              host={runtime.hostMetrics}
              render={renderDiagnostics}
              digest={projection.digest}
              onClose={() => togglePanel('metrics')}
            />
          )}
        </>
      )}
      <aside
        className="intervention-panel glass-panel"
        aria-label="Observer interventions"
        hidden={interfaceHidden || !panels.interventions}
      >
        <button className="floating-close close-button" type="button" onClick={() => togglePanel('interventions')} aria-label="Close interventions">×</button>
        <ObserverInterventions
          currentDay={projection.day}
          targetSettlementId={projection.settlementId}
          onSubmitIntervention={runtime.submitIntervention}
        />
      </aside>
      <aside
        className="signals-panel glass-panel"
        aria-label="External information signals"
        hidden={interfaceHidden || !panels.signals}
      >
        <button className="floating-close close-button" type="button" onClick={() => togglePanel('signals')} aria-label="Close outside signals">×</button>
        <ExternalSignals
          currentDay={projection.day}
          effectiveDay={projection.day + 1}
          onSubmitSignal={runtime.submitSignal}
        />
      </aside>
      <CameraDock
        mode={cameraMode}
        hasSelectedPerson={selectedPerson !== null}
        hasSelection={selection !== null}
        selectionPanelOpen={selectionPanelOpen}
        interfaceHidden={interfaceHidden}
        onModeChange={handleCameraMode}
        onToggleSelectionPanel={() => setSelectionPanelOpen((open) => !open)}
        onToggleInterface={() => setInterfaceHidden((hidden) => !hidden)}
      />
      {(importError ?? runtime.error) !== null && (
        <p className="error-toast" role="alert">{importError ?? runtime.error}</p>
      )}
      {showWelcome && (
        <WelcomeOverlay onEnter={() => {
          setShowWelcome(false);
        }} />
      )}
      <input
        ref={importInputRef}
        className="visually-hidden-file"
        type="file"
        accept=".json,.current.json,application/json"
        onChange={(event) => { void handleImportFile(event); }}
        aria-label="Import world history"
      />
    </main>
  );
}
