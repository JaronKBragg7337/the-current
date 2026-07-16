import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  createSimulation,
  type BuildingType,
  type ResourceKind,
  type SimulationMetrics,
} from '../src/simulation/index.ts';

const DAYS = 365;
const STREAMS = 12;
const SEED = 'era-one-candidate';
const OUTPUT = resolve('benchmarks/results/era-one-distribution.json');
const RESOURCE_KINDS: readonly ResourceKind[] = [
  'energy', 'food', 'medicine', 'stone', 'tools', 'transport', 'water', 'wood',
];

interface StreamResult {
  stream: number;
  digest: string;
  metrics: SimulationMetrics;
  buildingCounts: Partial<Record<BuildingType, number>>;
  arrivalDays: number;
  maximumDailyArrivals: number;
  guaranteedArrivalEvents: number;
  invariantFailures: string[];
}

function runStream(stream: number): StreamResult {
  const simulation = createSimulation({ seed: SEED });
  let arrivalDays = 0;
  let maximumDailyArrivals = 0;
  let guaranteedArrivalEvents = 0;
  for (let day = 1; day <= DAYS; day += 1) {
    const result = simulation.advanceDay({
      signals: [],
      interventions: [],
      entropy: `era-one-audit:${stream}:${day}`,
    });
    const arrivals = result.events.filter((event) => event.type === 'arrival');
    if (arrivals.length > 0) arrivalDays += 1;
    maximumDailyArrivals = Math.max(maximumDailyArrivals, arrivals.length);
    guaranteedArrivalEvents += arrivals.filter((event) => event.data.guaranteed === true).length;
  }
  const metrics = simulation.metrics();
  const snapshot = simulation.snapshot();
  const buildingCounts: Partial<Record<BuildingType, number>> = {};
  for (const building of Object.values(snapshot.state.buildings)) {
    if (building.stage !== 'complete') continue;
    buildingCounts[building.type] = (buildingCounts[building.type] ?? 0) + 1;
  }
  const invariantFailures: string[] = [];
  const accountedPopulation = metrics.initialPopulation + metrics.totalEntrants + metrics.births - metrics.deaths;
  if (metrics.population !== accountedPopulation) {
    invariantFailures.push(`population ${metrics.population} != ${accountedPopulation} accounted residents`);
  }
  if (metrics.totalArtifacts !== 3) invariantFailures.push(`expected 3 Era Zero artifacts, found ${metrics.totalArtifacts}`);
  if (maximumDailyArrivals > 3) invariantFailures.push(`daily arrivals reached ${maximumDailyArrivals}`);
  if (arrivalDays >= DAYS) invariantFailures.push('migration occurred every day');
  if (guaranteedArrivalEvents > 0) invariantFailures.push(`${guaranteedArrivalEvents} arrivals were marked guaranteed`);
  for (const resource of RESOURCE_KINDS) {
    const stock = metrics.resourceStock[resource];
    const capacity = metrics.resourceCapacity[resource];
    if (stock < 0 || stock > capacity + 0.001) {
      invariantFailures.push(`${resource} stock ${stock} outside 0..${capacity}`);
    }
  }
  const wastePerResident = metrics.storedWaste / Math.max(1, metrics.population);
  if (wastePerResident > 1.5) invariantFailures.push(`stored waste per resident ${wastePerResident.toFixed(2)} > 1.5`);
  if (metrics.averageContamination > 30) {
    invariantFailures.push(`average contamination ${metrics.averageContamination.toFixed(2)} > 30`);
  }
  if (metrics.romanticInterests > Math.max(4, metrics.population * 1.5)) {
    invariantFailures.push(`${metrics.romanticInterests} romantic interests is excessive for population ${metrics.population}`);
  }
  const averageActiveDegree = metrics.activeSocialTies * 2 / Math.max(1, metrics.population);
  if (averageActiveDegree > Math.min(60, metrics.population - 1)) {
    invariantFailures.push(`average active social degree ${averageActiveDegree.toFixed(2)} is excessive`);
  }
  if (
    metrics.buildingsUnderConstruction > 0 &&
    metrics.resourceStock.wood === 0 && metrics.resourceStock.stone === 0 && metrics.resourceStock.tools === 0
  ) invariantFailures.push('an active construction project ended with every required material empty');

  return {
    stream,
    digest: snapshot.digest,
    metrics,
    buildingCounts,
    arrivalDays,
    maximumDailyArrivals,
    guaranteedArrivalEvents,
    invariantFailures,
  };
}

const results = Array.from({ length: STREAMS }, (_, stream) => runStream(stream + 1));
const replay = runStream(1);
const uniqueDigests = new Set(results.map((result) => result.digest)).size;
const populations = results.map((result) => result.metrics.population);
const entrants = results.map((result) => result.metrics.totalEntrants);
const buildingTotals = results.map((result) => result.metrics.buildingsComplete);
const distributionFailures: string[] = [];
if (uniqueDigests !== STREAMS) distributionFailures.push(`only ${uniqueDigests}/${STREAMS} futures diverged`);
if (replay.digest !== results[0]?.digest) distributionFailures.push('recorded entropy replay did not reproduce its digest');
if (new Set(populations).size < 3) distributionFailures.push('population outcomes showed too little variation');
if (new Set(entrants).size < 3) distributionFailures.push('migration outcomes showed too little variation');
if (new Set(buildingTotals).size < 2) distributionFailures.push('construction outcomes showed no variation');
const streamFailures = results.flatMap((result) =>
  result.invariantFailures.map((failure) => `stream ${result.stream}: ${failure}`),
);
const failures = [...distributionFailures, ...streamFailures];
const report = {
  generatedAtUtc: new Date().toISOString(),
  parameters: { days: DAYS, entropyStreams: STREAMS, seed: SEED },
  passed: failures.length === 0,
  failures,
  distribution: {
    uniqueDigests,
    population: { min: Math.min(...populations), max: Math.max(...populations) },
    entrants: { min: Math.min(...entrants), max: Math.max(...entrants) },
    buildings: { min: Math.min(...buildingTotals), max: Math.max(...buildingTotals) },
  },
  replay: { stream: 1, exact: replay.digest === results[0]?.digest, digest: replay.digest },
  streams: results,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ passed: report.passed, failures, distribution: report.distribution, replay: report.replay }, null, 2));
if (!report.passed) process.exitCode = 1;
