import { describe, expect, it } from 'vitest';

import {
  advanceEnvironmentalCondition,
  environmentalHealthBurden,
  facilityEnvironmentFactor,
  initialEnvironmentalCondition,
} from './environment';

describe('local environmental conditions', () => {
  it('makes healthy land and water materially more productive than hazardous conditions', () => {
    const healthyFarm = initialEnvironmentalCondition('farm');
    const damagedFarm = {
      fertility: 20,
      waterQuality: 30,
      contamination: 70,
      wasteLoad: 14,
      status: 'hazardous' as const,
    };
    const healthyWell = initialEnvironmentalCondition('well');
    const damagedWell = { ...damagedFarm };

    expect(facilityEnvironmentFactor('farm', healthyFarm))
      .toBeGreaterThan(facilityEnvironmentFactor('farm', damagedFarm) * 1.8);
    expect(facilityEnvironmentFactor('well', healthyWell))
      .toBeGreaterThan(facilityEnvironmentFactor('well', damagedWell) * 1.8);
    expect(environmentalHealthBurden(damagedWell)).toBeGreaterThan(environmentalHealthBurden(healthyWell));
  });

  it('degrades under persistent local waste and recovers when that named patch is cleaned', () => {
    let condition = initialEnvironmentalCondition('well');
    for (let day = 0; day < 40; day += 1) {
      condition = advanceEnvironmentalCondition(condition, 'well', {
        constructionActive: false,
        neighborContamination: condition.contamination,
        productionPressure: 1,
        sanitationCoverage: 0,
        wasteLoad: 10,
      });
    }
    const degraded = condition;
    expect(degraded.status).not.toBe('healthy');

    for (let day = 0; day < 30; day += 1) {
      condition = advanceEnvironmentalCondition(condition, 'well', {
        constructionActive: false,
        neighborContamination: condition.contamination,
        productionPressure: 0.2,
        sanitationCoverage: 1,
        wasteLoad: 0,
      });
    }
    expect(condition.contamination).toBeLessThan(degraded.contamination);
    expect(condition.waterQuality).toBeGreaterThan(degraded.waterQuality);
    expect(condition.status).toBe('healthy');
  });

  it('keeps every bounded condition finite under extreme pressure', () => {
    const condition = advanceEnvironmentalCondition(initialEnvironmentalCondition('workshop'), 'workshop', {
      constructionActive: true,
      neighborContamination: 100,
      productionPressure: 1_000,
      sanitationCoverage: -1_000,
      wasteLoad: 1_000,
    });
    for (const value of [condition.contamination, condition.fertility, condition.waterQuality]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(condition.wasteLoad).toBe(1_000);
    expect(condition.status).toBe('hazardous');
  });

  it('uses recovery margins so a patch does not flap at an exact status threshold', () => {
    const stressed = {
      fertility: 78,
      waterQuality: 92,
      contamination: 1,
      wasteLoad: 5,
      status: 'stressed' as const,
    };
    const nearThreshold = advanceEnvironmentalCondition(stressed, 'house', {
      constructionActive: false,
      neighborContamination: 1,
      productionPressure: 0,
      sanitationCoverage: 0,
      wasteLoad: 4.5,
    });
    expect(nearThreshold.status).toBe('stressed');

    const recovered = advanceEnvironmentalCondition(nearThreshold, 'house', {
      constructionActive: false,
      neighborContamination: nearThreshold.contamination,
      productionPressure: 0,
      sanitationCoverage: 1,
      wasteLoad: 3.5,
    });
    expect(recovered.status).toBe('healthy');
  });
});
