import type { RenderDiagnostics } from '../world/DiagnosticsBridge';
import type { HostPerformanceMetrics } from '../worker';
import type { SimulationMetrics } from '../simulation';

const RESOURCE_LABELS = {
  food: 'Food',
  water: 'Water',
  wood: 'Timber',
  stone: 'Stone',
  tools: 'Tools',
  energy: 'Energy',
  medicine: 'Care',
  transport: 'Transport',
} as const;

function quantity(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

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
        <h3>Population accounting</h3>
        <p><span>Founding residents</span><strong>{metrics.initialPopulation}</strong></p>
        <p><span>Arrivals</span><strong>{metrics.totalEntrants}</strong></p>
        <p><span>Births</span><strong>{metrics.births}</strong></p>
        <p><span>Deaths</span><strong>{metrics.deaths}</strong></p>
        <p><span>Natural / early deaths</span><strong>{metrics.naturalDeaths} / {metrics.earlyDeaths}</strong></p>
        <p><span>Active social ties</span><strong>{metrics.activeSocialTies}</strong></p>
        <p><span>Historical social ties</span><strong>{metrics.historicalSocialTies}</strong></p>
        <p><span>Uncommitted romantic interests</span><strong>{metrics.romanticInterests}</strong></p>
        <p><span>Current / lifetime partnerships</span><strong>{metrics.partnerships} / {metrics.lifetimePartnerships}</strong></p>
        <p><span>Estates transferred</span><strong>{metrics.inheritances}</strong></p>
        <p><span>Inherited value</span><strong>¤{metrics.inheritedValue.toFixed(0)}</strong></p>
        <p><span>Breakthroughs adopted</span><strong>{metrics.breakthroughAdoptions}</strong></p>
        <p><span>Era Zero artifacts found</span><strong>{metrics.discoveredArtifacts} / {metrics.totalArtifacts}</strong></p>
        <p><span>Artifact study effort</span><strong>{metrics.artifactStudyDays.toFixed(1)} days</strong></p>
      </section>
      <section className="population-readout resource-flow-readout">
        <h3>Daily resource ledger</h3>
        {(Object.keys(RESOURCE_LABELS) as (keyof typeof RESOURCE_LABELS)[]).map((resource) => (
          <p key={resource}>
            <span>{RESOURCE_LABELS[resource]}</span>
            <strong title="stored / capacity · produced − used − lost">
              {quantity(metrics.resourceStock[resource])}/{quantity(metrics.resourceCapacity[resource])}
              {' · +'}{quantity(metrics.resourceProductionLastDay[resource])}
              {' −'}{quantity(metrics.resourceConsumptionLastDay[resource])}
              {' −'}{quantity(metrics.resourceLossLastDay[resource])}
            </strong>
          </p>
        ))}
      </section>
      <section className="population-readout environment-readout">
        <h3>Environmental loop</h3>
        <p><span>Farm soil fertility</span><strong>{metrics.averageFertility.toFixed(1)}%</strong></p>
        <p><span>Well water quality</span><strong>{metrics.averageWaterQuality.toFixed(1)}%</strong></p>
        <p><span>Stored drinking water</span><strong>{metrics.drinkingWaterQuality.toFixed(1)}%</strong></p>
        <p><span>Site contamination</span><strong>{metrics.averageContamination.toFixed(1)}%</strong></p>
        <p><span>Stored waste</span><strong>{metrics.storedWaste.toFixed(1)}</strong></p>
        <p><span>Waste created today</span><strong>{metrics.wasteCreatedLastDay.toFixed(1)}</strong></p>
        <p><span>Waste removed today</span><strong>{metrics.wasteRemovedLastDay.toFixed(1)}</strong></p>
      </section>
      <p className="digest-line"><span>State digest</span><code>{digest}</code></p>
    </aside>
  );
}
