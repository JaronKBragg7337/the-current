import type {
  Building,
  BuildingType,
  EnvironmentalCondition,
  EnvironmentalStatus,
} from './types';

const STATUS_SEVERITY: Record<EnvironmentalStatus, number> = {
  healthy: 0,
  stressed: 1,
  hazardous: 2,
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, places = 4): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function environmentalStatus(
  condition: Pick<EnvironmentalCondition, 'contamination' | 'fertility' | 'waterQuality' | 'wasteLoad'>,
  type: BuildingType,
  previous?: EnvironmentalStatus,
): EnvironmentalStatus {
  const hazardous =
    condition.contamination >= 60 || condition.waterQuality <= 35 || condition.wasteLoad >= 12 ||
    (type === 'farm' && condition.fertility <= 25);
  const stressed =
    condition.contamination >= 30 || condition.waterQuality <= 60 || condition.wasteLoad >= 5 ||
    (type === 'farm' && condition.fertility <= 45);
  if (previous === 'hazardous') {
    const clearedHazard = condition.contamination < 55 && condition.waterQuality > 40 && condition.wasteLoad < 10 &&
      (type !== 'farm' || condition.fertility > 30);
    if (!clearedHazard) return 'hazardous';
  }
  if (hazardous) return 'hazardous';
  if (previous === 'stressed' || previous === 'hazardous') {
    const clearedStress = condition.contamination < 25 && condition.waterQuality > 65 && condition.wasteLoad < 4 &&
      (type !== 'farm' || condition.fertility > 50);
    return clearedStress ? 'healthy' : 'stressed';
  }
  return stressed ? 'stressed' : 'healthy';
}

export function initialEnvironmentalCondition(type: BuildingType): EnvironmentalCondition {
  const condition = { fertility: 78, waterQuality: 92, contamination: 1, wasteLoad: 0 };
  return { ...condition, status: environmentalStatus(condition, type) };
}

export interface EnvironmentDayInputs {
  productionPressure: number;
  wasteLoad: number;
  sanitationCoverage: number;
  constructionActive: boolean;
  neighborContamination: number;
}

export function advanceEnvironmentalCondition(
  previous: EnvironmentalCondition,
  type: BuildingType,
  inputs: EnvironmentDayInputs,
): EnvironmentalCondition {
  const production = clamp(inputs.productionPressure, 0, 2.5);
  const wasteBurden = clamp(inputs.wasteLoad / 6, 0, 2.5);
  const sanitation = clamp(inputs.sanitationCoverage, 0, 1);
  const industrialSensitivity: Partial<Record<BuildingType, number>> = {
    market: 0.04,
    'power-station': 0.38,
    warehouse: 0.06,
    workshop: 0.28,
  };
  const wasteSensitivity: Record<BuildingType, number> = {
    clinic: 0.16,
    'council-hall': 0.14,
    farm: 0.2,
    house: 0.24,
    market: 0.3,
    'power-station': 0.38,
    road: 0.12,
    school: 0.16,
    warehouse: 0.28,
    well: 0.36,
    workshop: 0.34,
  };
  const contaminationGain = wasteBurden * wasteSensitivity[type] +
    production * (industrialSensitivity[type] ?? 0) +
    (inputs.constructionActive ? 0.16 : 0);
  const contaminationRecovery = 0.08 + sanitation * (type === 'well' ? 0.72 : 0.48);
  const contaminationDiffusion = (inputs.neighborContamination - previous.contamination) * 0.03;
  const contamination = clamp(previous.contamination + contaminationGain - contaminationRecovery + contaminationDiffusion);

  const waterRecovery = (100 - previous.waterQuality) * 0.018 + sanitation * 0.16;
  const waterDamage = contamination / 100 * (type === 'well' ? 0.66 : 0.34) +
    wasteBurden * (type === 'well' ? 0.14 : 0.05) +
    (type === 'well' ? production * 0.05 : 0);
  const waterQuality = clamp(previous.waterQuality + waterRecovery - waterDamage);

  const naturalSoilRecovery = (100 - previous.fertility) * 0.008 + sanitation * 0.025;
  const harvestDraw = type === 'farm' ? production * 0.16 : 0;
  const industrialDraw = (type === 'workshop' || type === 'power-station') ? production * 0.025 : 0;
  const fertility = clamp(
    previous.fertility + naturalSoilRecovery - harvestDraw - industrialDraw -
      contamination * 0.0025 - (inputs.constructionActive ? 0.1 : 0),
  );

  const condition = {
    fertility: round(fertility),
    waterQuality: round(waterQuality),
    contamination: round(contamination),
    wasteLoad: round(Math.max(0, inputs.wasteLoad)),
  };
  return { ...condition, status: environmentalStatus(condition, type, previous.status) };
}

export function facilityEnvironmentFactor(type: BuildingType, condition: EnvironmentalCondition): number {
  const contaminationFactor = 1 - condition.contamination / 250;
  switch (type) {
    case 'farm':
      return clamp(
        (0.55 + condition.fertility / 173.333) *
          (0.7 + condition.waterQuality / 306.667) *
          contaminationFactor * 1.025,
        0.2,
        1.05,
      );
    case 'well':
      return clamp((0.35 + condition.waterQuality / 141.538) * (1 - condition.contamination / 200), 0.15, 1.02);
    case 'power-station':
    case 'workshop':
      return clamp(contaminationFactor, 0.5, 1);
    default:
      return 1;
  }
}

export function environmentalHealthBurden(condition: EnvironmentalCondition): number {
  return clamp(
    condition.contamination / 100 * 0.9 +
    (100 - condition.waterQuality) / 100 * 0.55 +
    Math.min(1, condition.wasteLoad / 12) * 0.25,
    0,
    1.45,
  );
}

export function compareEnvironmentalStatus(previous: EnvironmentalStatus, next: EnvironmentalStatus): -1 | 0 | 1 {
  const difference = STATUS_SEVERITY[next] - STATUS_SEVERITY[previous];
  return difference === 0 ? 0 : difference > 0 ? 1 : -1;
}

export function summarizeEnvironment(buildings: readonly Building[]): {
  averageContamination: number;
  averageFertility: number;
  averageWaterQuality: number;
} {
  const complete = buildings.filter((building) => building.stage === 'complete' && building.type !== 'road');
  const farms = complete.filter((building) => building.type === 'farm');
  const wells = complete.filter((building) => building.type === 'well');
  const average = (items: readonly Building[], value: (building: Building) => number): number =>
    items.length === 0 ? 0 : round(items.reduce((sum, item) => sum + value(item), 0) / items.length);
  return {
    averageContamination: average(complete, (building) => building.environment.contamination),
    averageFertility: average(farms, (building) => building.environment.fertility),
    averageWaterQuality: average(wells, (building) => building.environment.waterQuality),
  };
}
