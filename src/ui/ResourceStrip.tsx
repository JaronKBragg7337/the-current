import type { ResourceLedger, SimulationMetrics } from '../simulation';

interface ResourceStripProps {
  resources: ResourceLedger;
  metrics: SimulationMetrics;
}
const RESOURCE_ITEMS = [
  { key: 'food', label: 'Food', icon: '◒' },
  { key: 'water', label: 'Water', icon: '◉' },
  { key: 'wood', label: 'Timber', icon: '╱' },
  { key: 'stone', label: 'Stone', icon: '◆' },
  { key: 'energy', label: 'Energy', icon: 'ϟ' },
  { key: 'medicine', label: 'Care', icon: '+' },
] as const;

export function ResourceStrip({ resources, metrics }: ResourceStripProps) {
  return (
    <section className="resource-strip" aria-label="Settlement resources">
      {RESOURCE_ITEMS.map((item) => {
        const value = resources[item.key];
        const urgent = (item.key === 'food' && value < metrics.population * 1.25) ||
          (item.key === 'water' && value < metrics.population * 1.8);
        return (
          <div key={item.key} className={urgent ? 'resource urgent' : 'resource'}>
            <span className="resource-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            <strong>{Math.round(value).toLocaleString()}</strong>
          </div>
        );
      })}
      <div className="resource housing-resource">
        <span className="resource-icon" aria-hidden="true">⌂</span>
        <span>Housing</span>
        <strong>{metrics.occupiedHousing}/{metrics.housingCapacity}</strong>
      </div>
      <div className="resource desktop-only">
        <span className="resource-icon" aria-hidden="true">⌁</span>
        <span>Work</span>
        <strong>{metrics.employed}</strong>
      </div>
    </section>
  );
}
