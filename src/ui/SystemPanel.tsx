import type { RenderDiagnostics } from '../world/DiagnosticsBridge';
import type { HostPerformanceMetrics } from '../worker';
import type { SimulationMetrics } from '../simulation';

interface SystemPanelProps {
  metrics: SimulationMetrics;
  host: HostPerformanceMetrics | null;
  render: RenderDiagnostics;
  digest: string;
  onClose: () => void;
}

export function SystemPanel({ metrics, host, render, digest, onClose }: SystemPanelProps) {
  return (
    <aside className="system-panel glass-panel" aria-label="Simulation and renderer diagnostics">
      <div className="panel-heading">
        <div><p className="eyebrow">Inspectable system</p><h2>Diagnostics</h2></div>
        <button className="close-button" type="button" onClick={onClose} aria-label="Close diagnostics">×</button>
      </div>
      <dl className="diagnostic-grid">
        <div><dt>Frame rate</dt><dd>{render.fps} fps</dd></div>
        <div><dt>Draw calls</dt><dd>{render.calls}</dd></div>
        <div><dt>Triangles</dt><dd>{render.triangles.toLocaleString()}</dd></div>
        <div><dt>Rendered NPCs</dt><dd>{metrics.population}</dd></div>
        <div><dt>Tick / day</dt><dd>{host === null ? '—' : `${host.averageMillisecondsPerDay.toFixed(2)} ms`}</dd></div>
        <div><dt>Snapshot</dt><dd>{(metrics.saveApproximateBytes / 1_048_576).toFixed(2)} MB</dd></div>
        <div><dt>Events</dt><dd>{metrics.eventCount.toLocaleString()}</dd></div>
        <div><dt>Geometries</dt><dd>{render.geometries}</dd></div>
      </dl>
      <section className="population-readout">
        <h3>Population loop</h3>
        <p><span>Arrivals</span><strong>{metrics.totalEntrants}</strong></p>
        <p><span>Births</span><strong>{metrics.births}</strong></p>
        <p><span>Deaths</span><strong>{metrics.deaths}</strong></p>
        <p><span>Relationships</span><strong>{metrics.relationships}</strong></p>
        <p><span>Inheritances</span><strong>¤{metrics.inheritedValue.toFixed(0)}</strong></p>
        <p><span>Breakthroughs adopted</span><strong>{metrics.breakthroughAdoptions}</strong></p>
      </section>
      <p className="digest-line"><span>State digest</span><code>{digest}</code></p>
    </aside>
  );
}
