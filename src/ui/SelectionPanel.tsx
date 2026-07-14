import type { CameraMode, Selection, VehicleProjection } from '../app/types';
import type {
  BuildingProjection,
  Person,
  PersonProjection,
  SimulationEvent,
} from '../simulation';
import { hasObservableRareEvidence } from './rareEvidence';

interface SelectionPanelProps {
  selection: Selection;
  person: PersonProjection | null;
  building: BuildingProjection | null;
  vehicle: VehicleProjection | null;
  inspectedPerson: Person | null;
  events: SimulationEvent[];
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  onClose: () => void;
}

function formatTask(task: string): string {
  return task.replaceAll('-', ' ');
}

export function SelectionPanel({
  selection,
  person,
  building,
  vehicle,
  inspectedPerson,
  events,
  cameraMode,
  onCameraModeChange,
  onClose,
}: SelectionPanelProps) {
  if (selection === null) return null;
  const relatedEvents = events.filter((event) => event.entityIds.includes(selection.id)).slice(-6).reverse();

  return (
    <aside className="selection-panel glass-panel" aria-label="Selected world entity">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{selection.kind}</p>
          <h2>{person?.name ?? building?.name ?? vehicle?.name ?? 'No longer present'}</h2>
        </div>
        <button className="close-button" type="button" onClick={onClose} aria-label="Close selection panel">×</button>
      </div>

      {person !== null && (
        <>
          <div className="camera-tabs" role="group" aria-label="Spectator camera mode">
            {(['orbital', 'follow', 'first-person'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cameraMode === mode ? 'active' : ''}
                onClick={() => onCameraModeChange(mode)}
              >
                {mode === 'orbital' ? 'Orbit' : mode === 'follow' ? 'Follow' : 'See through'}
              </button>
            ))}
          </div>
          <p className="autonomy-note"><i /> View only — {person.name.split(' ')[0]} remains autonomous.</p>
          <dl className="fact-grid">
            <div><dt>Life stage</dt><dd>{person.lifeStage.replace('-', ' ')}</dd></div>
            <div><dt>Occupation</dt><dd>{person.occupation}</dd></div>
            <div><dt>Current task</dt><dd>{formatTask(person.task)}</dd></div>
            <div><dt>Health</dt><dd>{Math.round(person.health)}%</dd></div>
            {inspectedPerson !== null && inspectedPerson.id === person.id && (
              <>
                <div>
                  <dt>Age</dt>
                  <dd>
                    {inspectedPerson.ageDays} days
                    {inspectedPerson.origin === 'born'
                      ? ' (born in the settlement)'
                      : ` (arrived aged ${inspectedPerson.arrivalDay - inspectedPerson.birthDay})`}
                  </dd>
                </div>
                <div><dt>Money</dt><dd>¤{inspectedPerson.wealth.toFixed(1)}</dd></div>
                <div><dt>Children</dt><dd>{inspectedPerson.childrenIds.length}</dd></div>
                <div><dt>Followers</dt><dd>{inspectedPerson.followersIds.length}</dd></div>
              </>
            )}
          </dl>
          <section className="decision-card">
            <p className="eyebrow">Why this action</p>
            <p>{person.decisionReason}</p>
          </section>
          {hasObservableRareEvidence(person.rareEvidence) && (
            <p className="evidence-note">Observers have seen an unusually broad pattern of skill, influence, or experimentation. Its significance is not yet known.</p>
          )}
          {inspectedPerson !== null && inspectedPerson.id === person.id && inspectedPerson.memories.length > 0 && (
            <section className="memory-list">
              <h3>Recent memories</h3>
              <ol>
                {inspectedPerson.memories.slice(-4).reverse().map((memory, index) => (
                  <li key={`${memory.day}:${memory.subjectId}:${index}`}>
                    <span>Day {memory.day}</span>
                    <p>{memory.summary}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {building !== null && (
        <>
          <dl className="fact-grid">
            <div><dt>Purpose</dt><dd>{building.type.replace('-', ' ')}</dd></div>
            <div><dt>Stage</dt><dd>{building.stage.replace('-', ' ')}</dd></div>
            <div><dt>Progress</dt><dd>{Math.round(building.progress * 100)}%</dd></div>
            <div><dt>Condition</dt><dd>{Math.round(building.condition)}%</dd></div>
            <div><dt>Capacity</dt><dd>{building.capacity}</dd></div>
            <div><dt>Present</dt><dd>{building.occupied}</dd></div>
          </dl>
          {building.stage !== 'complete' && (
            <section className="decision-card">
              <p className="eyebrow">Physical construction</p>
              <p>This site advances only when labor and delivered materials satisfy its current stage.</p>
              <div className="progress-track"><i style={{ width: `${Math.round(building.progress * 100)}%` }} /></div>
            </section>
          )}
        </>
      )}

      {vehicle !== null && (
        <>
          <dl className="fact-grid">
            <div><dt>Status</dt><dd>{vehicle.active ? 'in service' : 'idle'}</dd></div>
            <div><dt>Cargo</dt><dd>{vehicle.cargo}</dd></div>
            <div><dt>Route</dt><dd>{Math.round(vehicle.routeProgress * 100)}% complete</dd></div>
          </dl>
          <section className="decision-card">
            <p className="eyebrow">Goods movement</p>
            <p>This vehicle visualizes the settlement’s authoritative transport capacity and material flow. It is not controllable.</p>
          </section>
        </>
      )}

      {relatedEvents.length > 0 && (
        <section className="entity-history">
          <h3>Recorded history</h3>
          <ol>
            {relatedEvents.map((event) => (
              <li key={event.sequence}>
                <span>Day {event.day}</span>
                <p>{event.summary}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  );
}
