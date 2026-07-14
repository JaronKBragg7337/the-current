import type { CameraMode } from '../app/types';

interface CameraDockProps {
  mode: CameraMode;
  hasSelectedPerson: boolean;
  hasSelection: boolean;
  selectionPanelOpen: boolean;
  interfaceHidden: boolean;
  onModeChange: (mode: CameraMode) => void;
  onToggleSelectionPanel: () => void;
  onToggleInterface: () => void;
}
export function CameraDock({
  mode,
  hasSelectedPerson,
  hasSelection,
  selectionPanelOpen,
  interfaceHidden,
  onModeChange,
  onToggleSelectionPanel,
  onToggleInterface,
}: CameraDockProps) {
  return (
    <nav className="camera-dock" aria-label="Spectator camera">
      <button type="button" className={mode === 'orbital' ? 'active' : ''} onClick={() => onModeChange('orbital')}>
        <span aria-hidden="true">◎</span><small>Orbit</small><kbd>1</kbd>
      </button>
      <button type="button" className={mode === 'follow' ? 'active' : ''} disabled={!hasSelectedPerson} onClick={() => onModeChange('follow')}>
        <span aria-hidden="true">◉</span><small>Follow</small><kbd>2</kbd>
      </button>
      <button type="button" className={mode === 'first-person' ? 'active' : ''} disabled={!hasSelectedPerson} onClick={() => onModeChange('first-person')}>
        <span aria-hidden="true">⌁</span><small>See through</small><kbd>3</kbd>
      </button>
      {hasSelection && (
        <button type="button" className={selectionPanelOpen ? 'active' : ''} onClick={onToggleSelectionPanel} aria-label="Selected entity details">
          <span aria-hidden="true">◇</span><small>Details</small>
        </button>
      )}
      <button type="button" className={interfaceHidden ? 'active' : ''} onClick={onToggleInterface}>
        <span aria-hidden="true">◫</span><small>Interface</small><kbd>H</kbd>
      </button>
    </nav>
  );
}
