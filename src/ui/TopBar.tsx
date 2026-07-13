import type { CameraMode } from '../app/types';

interface TopBarProps {
  day: number;
  population: number;
  settlementName: string;
  cameraMode: CameraMode;
  paused: boolean;
  speed: number;
  saveStatus: 'error' | 'idle' | 'saving' | 'saved';
  usingWorker: boolean;
  /**
   * True when this client is spectating the single shared authoritative
   * world. Time controls, saving, and importing are hidden: one world
   * exists, it advances at its own fixed pace, and every viewer sees the
   * same thing regardless of who is watching.
   */
  liveWorld: boolean;
  panelsOpen: { history: boolean; interventions: boolean; metrics: boolean; signals: boolean };
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onAdvanceDay: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onTogglePanel: (panel: keyof TopBarProps['panelsOpen']) => void;
}
export function TopBar({
  day,
  population,
  settlementName,
  cameraMode,
  paused,
  speed,
  saveStatus,
  usingWorker,
  liveWorld,
  panelsOpen,
  onTogglePause,
  onSpeedChange,
  onAdvanceDay,
  onSave,
  onExport,
  onImport,
  onTogglePanel,
}: TopBarProps) {
  return (
    <header className="top-bar" aria-label="World controls">
      <div className="identity-lockup">
        <span className="current-mark" aria-hidden="true"><i /><i /><i /></span>
        <div>
          <p className="eyebrow">Heartbeat Observatory / World 01</p>
          <h1>The Current</h1>
        </div>
      </div>

      <div className="world-pulse" aria-label={`World day ${day}, ${population} living people`}>
        <div>
          <span>World day</span>
          <strong>{day.toLocaleString()}</strong>
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

      {liveWorld ? (
        <nav className="time-controls" aria-label="Shared world status">
          <span
            className="worker-status isolated live-world-badge"
            title="One shared world, advancing at a fixed pace for every viewer. Time cannot be controlled from here."
          >
            <i /> LIVE — one shared world
          </span>
        </nav>
      ) : (
        <nav className="time-controls" aria-label="Simulation time">
          <button className="icon-button primary-control" type="button" onClick={onTogglePause} aria-label={paused ? 'Resume time' : 'Pause time'}>
            <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
          </button>
          <label className="speed-control">
            <span className="sr-only">World speed</span>
            <select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}>
              <option value={0.25}>¼×</option>
              <option value={1}>1×</option>
              <option value={4}>4×</option>
              <option value={16}>16×</option>
              <option value={64}>64×</option>
            </select>
          </label>
          <button className="icon-button" type="button" onClick={onAdvanceDay} aria-label="Advance one world day">+1d</button>
        </nav>
      )}

      <nav className="panel-controls" aria-label="World panels">
        <button type="button" className={panelsOpen.history ? 'active' : ''} onClick={() => onTogglePanel('history')}>History</button>
        <button type="button" className={panelsOpen.interventions ? 'active' : ''} onClick={() => onTogglePanel('interventions')}>Influence</button>
        <button type="button" className={panelsOpen.signals ? 'active desktop-only' : 'desktop-only'} onClick={() => onTogglePanel('signals')}>Signals</button>
        <button type="button" className={panelsOpen.metrics ? 'active desktop-only' : 'desktop-only'} onClick={() => onTogglePanel('metrics')}>System</button>
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
