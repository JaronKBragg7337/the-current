import type { SimulationEvent } from '../simulation';

interface EventTimelineProps {
  events: SimulationEvent[];
  onClose: () => void;
  onJumpTo: (entityId: string) => void;
}
export function EventTimeline({ events, onClose, onJumpTo }: EventTimelineProps) {
  return (
    <aside className="history-panel glass-panel" aria-label="Recent world history">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">The living record</p>
          <h2>Recent history</h2>
        </div>
        <button className="close-button" type="button" onClick={onClose} aria-label="Close history">×</button>
      </div>
      <ol className="timeline-list">
        {[...events].reverse().map((event) => (
          <li key={event.sequence} className={`event-${event.type}`}>
            <span className="event-day">Day {event.day}</span>
            <div>
              <strong>{event.type.replaceAll('-', ' ')}</strong>
              <p>{event.summary}</p>
              {event.entityIds[0] !== undefined && (
                <button type="button" onClick={() => onJumpTo(event.entityIds[0] ?? '')}>Find in world</button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
