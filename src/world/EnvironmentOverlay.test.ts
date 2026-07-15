import { describe, expect, it } from 'vitest';

import type { BuildingProjection } from '../simulation';
import { environmentOverlayColor, environmentOverlayValue } from './environmentOverlayModel';

const building: BuildingProjection = {
  id: 'building:environment-test' as BuildingProjection['id'],
  name: 'Test farm',
  type: 'farm',
  position: { x: 0, y: 0, z: 0 },
  stage: 'complete',
  progress: 1,
  capacity: 8,
  condition: 100,
  environment: { fertility: 63, waterQuality: 54, contamination: 31, wasteLoad: 4, status: 'stressed' },
  occupied: 2,
};

describe('environment overlay projection', () => {
  it('reads only authoritative building values', () => {
    expect(environmentOverlayValue(building, 'fertility')).toBe(63);
    expect(environmentOverlayValue(building, 'waterQuality')).toBe(54);
    expect(environmentOverlayValue(building, 'contamination')).toBe(31);
  });

  it('uses stable, severity-aware colors for every selectable metric', () => {
    expect(environmentOverlayColor('fertility', 20)).toBe('#df5d4f');
    expect(environmentOverlayColor('fertility', 80)).toBe('#72b878');
    expect(environmentOverlayColor('waterQuality', 30)).toBe('#df5d4f');
    expect(environmentOverlayColor('waterQuality', 90)).toBe('#5fb7c6');
    expect(environmentOverlayColor('contamination', 10)).toBe('#62b69a');
    expect(environmentOverlayColor('contamination', 70)).toBe('#df5d4f');
  });
});
