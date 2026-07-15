import type { EnvironmentOverlayMetric } from '../app/types';
import type { BuildingProjection } from '../simulation';

export function environmentOverlayValue(building: BuildingProjection, metric: EnvironmentOverlayMetric): number {
  return building.environment[metric];
}

export function environmentOverlayColor(metric: EnvironmentOverlayMetric, value: number): string {
  if (metric === 'contamination') {
    if (value >= 60) return '#df5d4f';
    if (value >= 30) return '#d8b85b';
    return '#62b69a';
  }
  if (metric === 'waterQuality') {
    if (value <= 35) return '#df5d4f';
    if (value <= 60) return '#d8b85b';
    return '#5fb7c6';
  }
  if (value <= 25) return '#df5d4f';
  if (value <= 45) return '#d8b85b';
  return '#72b878';
}
