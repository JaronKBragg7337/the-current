import { describe, expect, it } from 'vitest';

import { createRoadRibbonGeometry } from './roadGeometry';
import { resourceTier } from './visualProjection';

describe('visual projection systems', () => {
  it('maps resource stocks to stable aggregate quantity tiers', () => {
    expect([0, 4, 5, 18, 19, 55, 56, 500].map(resourceTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('winds authoritative road ribbons upward for spectator cameras', () => {
    const geometry = createRoadRibbonGeometry([{ x: -4, z: 0 }, { x: 4, z: 0 }], 2);
    const normal = geometry.getAttribute('normal');
    expect(normal).toBeDefined();
    for (let index = 0; index < (normal?.count ?? 0); index += 1) {
      expect(normal?.getY(index)).toBeGreaterThan(0.99);
    }
    geometry.dispose();
  });
});
