import { useEffect, useState } from 'react';

import type { CameraMode, EnvironmentOverlayMetric } from '../app/types';
import { formatWorldTimeOfDay, worldNowMs } from '../app/worldClock';

/** One world minute is one real minute, so a coarse tick is enough for HH:MM. */
const CLOCK_TICK_MS = 10_000;

interface TopBarProps {
  day: number;
  /** When the current world day began; null until a world publishes it. */
  dayStartedAtUtc: string | null;
  worldDayDurationMs: number | null;
  population: number;
  settlementName: string;
  cameraMode: CameraMode;
  saveStatus: 'error' | 'idle' | 'saving' | 'saved';
  usingWorker: boolean;
  /**
   * True when this client is spectating the single shared authoritative
   * world. Saving and importing are hidden: one world exists, and every
   * viewer sees the same thing regardless of who is watching. No world of
   * either kind offers time controls — time is a property of the world.
   */
  liveWorld: boolean;
  environmentOverlay: EnvironmentOverlayMetric | null;
  panelsOpen: { history: boolean; interventions: boolean; metrics: boolean; signals: boolean };
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onEnvironmentOverlayChange: (metric: EnvironmentOverlayMetric | null) => void;
  onTogglePanel: (panel: keyof TopBarProps['panelsOpen']) => void;
}

function useWorldTimeOfDay(
  dayStartedAtUtc: string | null,
  worldDayDurationMs: number | null,
): string | null {
  const [nowMs, setNowMs] = useState(() => worldNowMs());
  useEffect(() => {
    if (dayStartedAtUtc === null || worldDayDurationMs === null) return undefined;
    setNowMs(worldNowMs());
    const timer = window.setInterval(() => setNowMs(worldNowMs()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [dayStartedAtUtc, worldDayDurationMs]);
  return formatWorldTimeOfDay(dayStartedAtUtc, worldDayDurationMs, nowMs);
}

export function TopBar({
  day,
  dayStartedAtUtc,
  worldDayDurationMs,
  population,
  settlementName,
  cameraMode,
  saveStatus,
  usingWorker,
  liveWorld,
  environmentOverlay,
  panelsOpen,
  onSave,
  onExport,
  onImport,
  onEnvironmentOverlayChange,
  onTogglePanel,
}: TopBarProps) {
  const timeOfDay = useWorldTimeOfDay(dayStartedAtUtc, worldDayDurationMs);

  return (
    <header className="top-bar" aria-label="World status">
      <div className="identity-lockup">
        <span className="current-mark" aria-hidden="true"><i /><i /><i /></span>
        <div>
          <p className="eyebrow">Heartbeat Observatory / World 01</p>
          <h1>The Current</h1>
        </div>
      </div>

      <div
        className="world-pulse"
        aria-label={`World day ${day}${timeOfDay === null ? '' : ` at ${timeOfDay}`}, ${population} living people`}
      >
        <div>
          <span>World day</span>
          <strong>{day.toLocaleString()}</strong>
        </div>
        <div className="world-clock">
          <span>Time</span>
          <strong>{timeOfDay ?? '--:--'}</strong>
        </div>
        <div>
          <span>Living</span>
          <strong>{population.toLocaleString()}</strong>
        </div>
        <div className="desktop-only">
          <span>Settlement</span>
          <strong>{settlementName}</strong>
        </div>
        <div className="desktop-only">
          <span>View</span>
          <strong>{cameraMode.replace('-', ' ')}</strong>
        </div>
      </div>

      <nav className="world-identity" aria-label="World identity">
        {liveWorld ? (
          <span
            className="worker-status isolated live-world-badge"
            title="One shared world, advancing one world day per real day for every viewer. Time cannot be controlled from here."
          >
            <i />
            <span className="badge-long">LIVE — one shared world</span>
            <span className="badge-short">LIVE</span>
          </span>
        ) : (
          <span
            className="worker-status fallback local-world-badge"
            title="A private world forked in this browser only. It also advances one world day per real day and is not the shared world."
          >
            <i />
            <span className="badge-long">Private fork — not the shared world</span>
            <span className="badge-short">Private fork</span>
          </span>
        )}
      </nav>

      <nav className="panel-controls" aria-label="World panels">
        <button type="button" className={panelsOpen.history ? 'active' : ''} onClick={() => onTogglePanel('history')}>History</button>
        <button type="button" className={panelsOpen.interventions ? 'active' : ''} onClick={() => onTogglePanel('interventions')}>Influence</button>
        <button type="button" className={panelsOpen.signals ? 'active' : ''} onClick={() => onTogglePanel('signals')}>Signals</button>
        <button type="button" className={panelsOpen.metrics ? 'active' : ''} onClick={() => onTogglePanel('metrics')}>System</button>
        <label className="environment-layer-control">
          <span>Layer</span>
          <select
            aria-label="Environmental overlay"
            value={environmentOverlay ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              onEnvironmentOverlayChange(value === '' ? null : value as EnvironmentOverlayMetric);
            }}
          >
            <option value="">Off</option>
            <option value="fertility">Soil fertility</option>
            <option value="waterQuality">Water quality</option>
            <option value="contamination">Contamination</option>
          </select>
        </label>
        {liveWorld ? (
          <div className="save-menu">
            <button type="button" className="compact-button" onClick={onExport} title="Download the current shared world snapshot">↓</button>
          </div>
        ) : (
          <div className="save-menu">
            <button type="button" onClick={onSave} title="Save world locally">
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Save'}
            </button>
            <button type="button" className="compact-button" onClick={onExport} title="Export complete world history">↓</button>
            <button type="button" className="compact-button" onClick={onImport} title="Import a world file">↑</button>
          </div>
        )}
        {!liveWorld && (
          <span className={`worker-status ${usingWorker ? 'isolated' : 'fallback'}`} title={usingWorker ? 'Simulation isolated in a worker' : 'In-process compatibility mode'}>
            <i /> {usingWorker ? 'worker' : 'fallback'}
          </span>
        )}
      </nav>
    </header>
  );
}
