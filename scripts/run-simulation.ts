import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  canonicalDigest,
  createSimulation,
  restoreSimulation,
  type CurrentSimulation,
  type DailySummary,
  type SimulationEventType,
  type SimulationMetrics,
  type WorldSnapshot,
} from '../src/simulation/index.ts';

interface CliOptions {
  days: number;
  seed: string;
  out: string | null;
  sampleEvery: number;
  verifyReplay: boolean;
  verifyRoundtrip: boolean;
  roundtripDay: number;
}

interface MutableCliOptions {
  days: number;
  seed: string;
  out: string | null;
  sampleEvery: number | null;
  verifyReplay: boolean;
  verifyRoundtrip: boolean;
  roundtripDay: number | null;
}

interface IntervalSample {
  day: number;
  population: number;
  bornPopulationAlive: number;
  births: number;
  deaths: number;
  households: number;
  partnerships: number;
  foodStock: number;
  foodProduced: number;
  foodConsumed: number;
  housingCapacity: number;
  homeless: number;
  employed: number;
  wealthMedian: number;
  wealthGini: number;
  inheritedValue: number;
  leaders: number;
  followerEdges: number;
  breakthroughAttempts: number;
  breakthroughAdoptions: number;
  buildingsComplete: number;
  averageFertility: number;
  averageWaterQuality: number;
  averageContamination: number;
  drinkingWaterQuality: number;
  storedWaste: number;
  wasteRemoved: number;
  saveApproximateBytes: number;
}

interface InvariantCheck {
  name: string;
  passed: boolean;
  detail: string;
}

interface InvariantAudit {
  passed: boolean;
  passedChecks: number;
  totalChecks: number;
  checks: InvariantCheck[];
}

interface SnapshotRoundtripResult {
  enabled: boolean;
  day: number | null;
  snapshotDigest: string | null;
  immediateDigestMatch: boolean | null;
}

interface ReplayResult {
  enabled: boolean;
  passed: boolean | null;
  comparedDays: number;
  elapsedMs: number | null;
  firstDayDigestMismatch: number | null;
  finalDigest: string | null;
  finalDigestMatch: boolean | null;
  snapshotRoundtrip: SnapshotRoundtripResult;
}

interface VerificationReport {
  formatVersion: 1;
  generatedAtUtc: string;
  parameters: {
    seed: string;
    days: number;
    sampleEvery: number;
    replayEnabled: boolean;
    snapshotRoundtripEnabled: boolean;
    roundtripDay: number | null;
  };
  simulation: {
    schemaVersion: number;
    engineVersion: string;
    simulationRevision: string | null;
    finalDigest: string;
    snapshotDigest: string;
    snapshotBytes: number;
  };
  runtime: {
    nodeVersion: string;
    platform: NodeJS.Platform;
    architecture: string;
    osRelease: string;
    logicalCpuCount: number;
    totalMemoryGiB: number;
  };
  performance: {
    primaryAdvanceMs: number;
    primaryWallMs: number;
    meanAdvanceMsPerDay: number;
    simulatedDaysPerSecond: number;
    peakRssBytes: number;
    finalRssBytes: number;
  };
  invariants: InvariantAudit;
  replay: ReplayResult;
  samples: IntervalSample[];
  finalMetrics: SimulationMetrics;
  finalDailySummary: DailySummary | null;
  eventWindow: {
    retainedEvents: number;
    totalEventSequence: number;
    historyTruncated: boolean;
    firstRetainedSequence: number | null;
    lastRetainedSequence: number | null;
    retainedTypeCounts: Partial<Record<SimulationEventType, number>>;
  };
}

const HELP = `The Current deterministic headless verifier

Usage:
  tsx scripts/run-simulation.ts [options]

Options:
  --days <n>             Number of world days to simulate (default: 150)
  --seed <text>          Saved deterministic seed (default: current-public-001)
  --out <file>           Write the JSON report to this file
  --sample-every <n>     Capture metrics every n days (default: about 10 samples)
  --replay               Compare a second seeded run (default)
  --no-replay            Skip the second deterministic run
  --roundtrip            Save/restore the replay at the verification day (default)
  --no-roundtrip         Replay without a save/restore boundary
  --roundtrip-day <n>    Save/restore after this day (default: halfway)
  --help                 Show this message
`;

function parseInteger(label: string, raw: string): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a positive whole number, received "${raw}".`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer.`);
  return value;
}

function parseArguments(args: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    days: 150,
    seed: 'current-public-001',
    out: null,
    sampleEvery: null,
    verifyReplay: true,
    verifyRoundtrip: true,
    roundtripDay: null,
  };

  const takeValue = (index: number, inlineValue: string | undefined, flag: string): { value: string; consumed: number } => {
    if (inlineValue !== undefined) {
      if (inlineValue.length === 0) throw new Error(`${flag} requires a value.`);
      return { value: inlineValue, consumed: 0 };
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
    return { value, consumed: 1 };
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    const equalsIndex = argument.indexOf('=');
    const flag = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1);
    if (flag === '--help' || flag === '-h') {
      if (inlineValue !== undefined) throw new Error(`${flag} does not accept a value.`);
      console.log(HELP);
      process.exit(0);
    }
    if (flag === '--replay') {
      if (inlineValue !== undefined) throw new Error('--replay does not accept a value.');
      options.verifyReplay = true;
      continue;
    }
    if (flag === '--no-replay') {
      if (inlineValue !== undefined) throw new Error('--no-replay does not accept a value.');
      options.verifyReplay = false;
      options.verifyRoundtrip = false;
      continue;
    }
    if (flag === '--roundtrip') {
      if (inlineValue !== undefined) throw new Error('--roundtrip does not accept a value.');
      options.verifyReplay = true;
      options.verifyRoundtrip = true;
      continue;
    }
    if (flag === '--no-roundtrip') {
      if (inlineValue !== undefined) throw new Error('--no-roundtrip does not accept a value.');
      options.verifyRoundtrip = false;
      continue;
    }
    if (!flag.startsWith('--')) throw new Error(`Unexpected positional argument "${argument}".`);

    const taken = takeValue(index, inlineValue, flag);
    index += taken.consumed;
    switch (flag) {
      case '--days': options.days = parseInteger('--days', taken.value); break;
      case '--seed': options.seed = taken.value.trim(); break;
      case '--out': options.out = taken.value; break;
      case '--sample-every': options.sampleEvery = parseInteger('--sample-every', taken.value); break;
      case '--roundtrip-day':
        options.roundtripDay = parseInteger('--roundtrip-day', taken.value);
        options.verifyReplay = true;
        options.verifyRoundtrip = true;
        break;
      default: throw new Error(`Unknown option "${flag}".`);
    }
  }

  if (options.seed.length === 0) throw new Error('--seed cannot be empty.');
  const sampleEvery = options.sampleEvery ?? Math.max(1, Math.floor(options.days / 10));
  const roundtripDay = options.roundtripDay ?? Math.max(1, Math.floor(options.days / 2));
  if (roundtripDay > options.days) throw new Error('--roundtrip-day cannot exceed --days.');
  return { ...options, sampleEvery, roundtripDay };
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function createSample(simulation: CurrentSimulation): IntervalSample {
  const metrics = simulation.metrics();
  return {
    day: metrics.day,
    population: metrics.population,
    bornPopulationAlive: metrics.bornPopulationAlive,
    births: metrics.births,
    deaths: metrics.deaths,
    households: metrics.households,
    partnerships: metrics.partnerships,
    foodStock: metrics.foodStock,
    foodProduced: metrics.foodProducedLastDay,
    foodConsumed: metrics.foodConsumedLastDay,
    housingCapacity: metrics.housingCapacity,
    homeless: metrics.homeless,
    employed: metrics.employed,
    wealthMedian: metrics.wealthMedian,
    wealthGini: metrics.wealthGini,
    inheritedValue: metrics.inheritedValue,
    leaders: metrics.leaders,
    followerEdges: metrics.followerEdges,
    breakthroughAttempts: metrics.breakthroughAttempts,
    breakthroughAdoptions: metrics.breakthroughAdoptions,
    buildingsComplete: metrics.buildingsComplete,
    averageFertility: metrics.averageFertility,
    averageWaterQuality: metrics.averageWaterQuality,
    averageContamination: metrics.averageContamination,
    drinkingWaterQuality: metrics.drinkingWaterQuality,
    storedWaste: metrics.storedWaste,
    wasteRemoved: metrics.wasteRemovedLastDay,
    saveApproximateBytes: metrics.saveApproximateBytes,
  };
}

function addCheck(checks: InvariantCheck[], name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
}

function allFinite(values: readonly number[]): boolean {
  return values.every(Number.isFinite);
}

function auditInvariants(
  simulation: CurrentSimulation,
  snapshot: WorldSnapshot,
  metrics: SimulationMetrics,
  options: CliOptions,
  wrongEntrantDays: readonly number[],
): InvariantAudit {
  const checks: InvariantCheck[] = [];
  const state = snapshot.state;
  const people = Object.values(state.people);
  const alive = people.filter((person) => person.alive);
  const dead = people.filter((person) => !person.alive);
  const projection = simulation.projection();

  addCheck(checks, 'clock-and-seed', state.day === options.days && snapshot.day === options.days && state.seed === options.seed,
    `day=${state.day}, snapshotDay=${snapshot.day}, seed=${state.seed}`);
  addCheck(checks, 'snapshot-digest', snapshot.digest === canonicalDigest(state) && snapshot.digest === simulation.digest(),
    `snapshot=${snapshot.digest}, live=${simulation.digest()}`);
  addCheck(checks, 'population-accounting',
    state.config.initialPopulation + state.counters.entrants + state.counters.births - state.counters.deaths === alive.length,
    `${state.config.initialPopulation} initial + ${state.counters.entrants} entrants + ${state.counters.births} births - ${state.counters.deaths} deaths = ${alive.length} living`);
  addCheck(checks, 'guaranteed-entrants',
    state.counters.entrants === options.days * state.config.entrantsPerDay && wrongEntrantDays.length === 0,
    `entrants=${state.counters.entrants}, expected=${options.days * state.config.entrantsPerDay}, wrongDays=${wrongEntrantDays.join(',') || 'none'}`);
  addCheck(checks, 'daily-summary-continuity',
    state.dailySummaries.length === options.days && state.dailySummaries.every((summary, index) => summary.day === index + 1),
    `summaries=${state.dailySummaries.length}, expected=${options.days}`);
  addCheck(checks, 'counter-record-consistency',
    people.filter((person) => person.origin === 'entrant').length === state.counters.entrants &&
      people.filter((person) => person.origin === 'born').length === state.counters.births && dead.length === state.counters.deaths,
    `entrant records=${people.filter((person) => person.origin === 'entrant').length}, born records=${people.filter((person) => person.origin === 'born').length}, dead records=${dead.length}`);
  addCheck(checks, 'lifespan-bounds', people.every((person) => {
    // Lifespan runs from birth, so this also guarantees no one — immigrant or
    // native — reaches a natural death age beyond the configured human ceiling.
    const lifespan = person.naturalDeathDay - person.birthDay;
    return lifespan >= state.config.lifespan.min && lifespan <= state.config.lifespan.max;
  }), `configured=${state.config.lifespan.min}-${state.config.lifespan.max} days`);
  addCheck(checks, 'lifecycle-consistency', people.every((person) =>
    person.ageDays >= 0 && (person.alive
      ? person.deathDay === null && person.deathCause === null
      : person.deathDay !== null && person.deathCause !== null && person.deathDay <= state.day)),
  `living=${alive.length}, dead=${dead.length}`);
  addCheck(checks, 'person-references', alive.every((person) =>
    state.households[person.householdId ?? ''] !== undefined &&
      (person.homeBuildingId === null || state.buildings[person.homeBuildingId] !== undefined) &&
      (person.employerId === null || state.buildings[person.employerId] !== undefined || state.institutions[person.employerId] !== undefined)),
  `${alive.length} living people checked`);
  addCheck(checks, 'partner-symmetry', alive.every((person) =>
    person.partnerId === null || state.people[person.partnerId]?.alive === true && state.people[person.partnerId]?.partnerId === person.id),
  `${alive.filter((person) => person.partnerId !== null).length / 2} living partnerships`);
  addCheck(checks, 'parent-child-reciprocity', people.filter((person) => person.origin === 'born').every((child) =>
    child.motherId !== null && child.fatherId !== null &&
      state.people[child.motherId]?.childrenIds.includes(child.id) === true &&
      state.people[child.fatherId]?.childrenIds.includes(child.id) === true),
  `${state.counters.births} births checked`);
  addCheck(checks, 'relationship-references', Object.values(state.relationships).every((relationship) =>
    relationship.personAId !== relationship.personBId && state.people[relationship.personAId] !== undefined && state.people[relationship.personBId] !== undefined),
  `${Object.keys(state.relationships).length} relationships checked`);
  addCheck(checks, 'housing-occupancy', Object.values(state.buildings).every((building) =>
    building.occupiedByIds.every((personId) => state.people[personId]?.alive === true && state.people[personId]?.homeBuildingId === building.id) &&
      (building.type !== 'house' || building.occupiedByIds.length <= building.capacity)),
  `capacity=${metrics.housingCapacity}, occupied=${metrics.occupiedHousing}, homeless=${metrics.homeless}`);
  addCheck(checks, 'resource-and-price-domain',
    allFinite(Object.values(state.settlement.resources)) && allFinite(Object.values(state.settlement.prices)) &&
      Object.values(state.settlement.resources).every((value) => value >= 0) && Object.values(state.settlement.prices).every((value) => value > 0),
    `food=${metrics.foodStock}, water=${metrics.waterStock}`);
  addCheck(checks, 'physical-state-domain', Object.values(state.buildings).every((building) =>
    allFinite([
      building.position.x,
      building.position.y,
      building.position.z,
      building.condition,
      building.capacity,
      building.environment.contamination,
      building.environment.fertility,
      building.environment.waterQuality,
      building.environment.wasteLoad,
    ]) && building.condition >= 0 && building.condition <= 100 &&
      building.environment.contamination >= 0 && building.environment.contamination <= 100 &&
      building.environment.fertility >= 0 && building.environment.fertility <= 100 &&
      building.environment.waterQuality >= 0 && building.environment.waterQuality <= 100 &&
      building.environment.wasteLoad >= 0), `${Object.keys(state.buildings).length} buildings checked`);
  const localizedWaste = Object.values(state.buildings)
    .reduce((sum, building) => sum + building.environment.wasteLoad, 0);
  addCheck(checks, 'environmental-stock-accounting',
    Math.abs(localizedWaste - state.settlement.waste) < 0.01 &&
      state.settlement.drinkingWaterQuality >= 0 && state.settlement.drinkingWaterQuality <= 100,
    `localWaste=${round(localizedWaste)}, cachedWaste=${round(state.settlement.waste)}, drinkingQuality=${round(state.settlement.drinkingWaterQuality)}`);
  addCheck(checks, 'institution-leaders', Object.values(state.institutions).every((institution) =>
    institution.leaderId === null || state.people[institution.leaderId]?.alive === true),
  `${metrics.leaders} active leaders across ${Object.keys(state.institutions).length} institutions`);
  addCheck(checks, 'event-order-and-time', state.events.every((event, index, events) =>
    event.day >= 0 && event.day <= state.day && event.tick === event.day * state.config.ticksPerDay &&
      (index === 0 || event.sequence > (events[index - 1]?.sequence ?? -1))),
  `${state.events.length} retained timestamped events checked`);
  addCheck(checks, 'render-projection-completeness',
    projection.people.length === alive.length && projection.people.every((person) => state.people[person.id]?.alive === true),
    `${projection.people.length}/${alive.length} living people projected`);
  addCheck(checks, 'finite-summary-metrics', allFinite([
    metrics.population, metrics.births, metrics.deaths, metrics.foodStock, metrics.waterStock,
    metrics.wealthTotal, metrics.wealthMedian, metrics.wealthGini, metrics.inheritedValue,
    metrics.averageFertility, metrics.averageWaterQuality, metrics.averageContamination,
    metrics.drinkingWaterQuality, metrics.storedWaste, metrics.wasteCreatedLastDay, metrics.wasteRemovedLastDay,
  ]), 'key aggregate metrics are finite');

  if (options.days >= 150) {
    addCheck(checks, '150-day-population-floor', metrics.population > 0 && metrics.births > 0 && metrics.deaths > 0,
      `population=${metrics.population}, births=${metrics.births}, deaths=${metrics.deaths}`);
    addCheck(checks, '150-day-social-floor', metrics.relationships > 0 && metrics.partnerships > 0 && metrics.households > 0,
      `relationships=${metrics.relationships}, partnerships=${metrics.partnerships}, households=${metrics.households}`);
    addCheck(checks, '150-day-economy-floor', metrics.employed > 0 && metrics.foodProducedLastDay > 0 && metrics.inheritedValue > 0,
      `employed=${metrics.employed}, foodProduced=${metrics.foodProducedLastDay}, inherited=${metrics.inheritedValue}`);
    addCheck(checks, '150-day-world-change-floor', metrics.buildingsComplete > 14 && metrics.leaders > 0 && metrics.breakthroughAttempts > 0,
      `completeBuildings=${metrics.buildingsComplete}, leaders=${metrics.leaders}, breakthroughs=${metrics.breakthroughAttempts}`);
  }

  const passedChecks = checks.filter((check) => check.passed).length;
  return { passed: passedChecks === checks.length, passedChecks, totalChecks: checks.length, checks };
}

function simulationRevision(): string | null {
  try {
    const revision = execFileSync('git', ['log', '-1', '--format=%H', '--', 'src/simulation'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return revision.length === 0 ? null : revision;
  } catch {
    return null;
  }
}

function countEventTypes(snapshot: WorldSnapshot): Partial<Record<SimulationEventType, number>> {
  const counts: Partial<Record<SimulationEventType, number>> = {};
  for (const event of snapshot.state.events) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))) as Partial<Record<SimulationEventType, number>>;
}

function verifyReplay(options: CliOptions, expectedDayDigests: readonly string[], expectedFinalDigest: string): ReplayResult {
  if (!options.verifyReplay) {
    return {
      enabled: false,
      passed: null,
      comparedDays: 0,
      elapsedMs: null,
      firstDayDigestMismatch: null,
      finalDigest: null,
      finalDigestMatch: null,
      snapshotRoundtrip: { enabled: false, day: null, snapshotDigest: null, immediateDigestMatch: null },
    };
  }

  const started = performance.now();
  let replay = createSimulation({ seed: options.seed });
  let firstDayDigestMismatch: number | null = null;
  let roundtripSnapshotDigest: string | null = null;
  let immediateDigestMatch: boolean | null = null;

  for (let day = 1; day <= options.days; day += 1) {
    const result = replay.advanceDay();
    if (firstDayDigestMismatch === null && result.digest !== expectedDayDigests[day - 1]) firstDayDigestMismatch = day;
    if (options.verifyRoundtrip && day === options.roundtripDay) {
      const beforeDigest = replay.digest();
      const snapshot = replay.snapshot();
      const restored = restoreSimulation(snapshot);
      roundtripSnapshotDigest = snapshot.digest;
      immediateDigestMatch = snapshot.digest === beforeDigest && restored.digest() === beforeDigest;
      replay = restored;
    }
  }

  const finalDigest = replay.digest();
  const finalDigestMatch = finalDigest === expectedFinalDigest;
  const passed = firstDayDigestMismatch === null && finalDigestMatch && immediateDigestMatch !== false;
  return {
    enabled: true,
    passed,
    comparedDays: options.days,
    elapsedMs: round(performance.now() - started),
    firstDayDigestMismatch,
    finalDigest,
    finalDigestMatch,
    snapshotRoundtrip: {
      enabled: options.verifyRoundtrip,
      day: options.verifyRoundtrip ? options.roundtripDay : null,
      snapshotDigest: roundtripSnapshotDigest,
      immediateDigestMatch,
    },
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const primaryWallStarted = performance.now();
  const simulation = createSimulation({ seed: options.seed });
  const expectedEntrantsPerDay = simulation.snapshot().state.config.entrantsPerDay;
  const samples: IntervalSample[] = [createSample(simulation)];
  const dayDigests: string[] = [];
  const wrongEntrantDays: number[] = [];
  let primaryAdvanceMs = 0;
  let peakRssBytes = process.memoryUsage().rss;

  for (let day = 1; day <= options.days; day += 1) {
    const advanceStarted = performance.now();
    const result = simulation.advanceDay();
    primaryAdvanceMs += performance.now() - advanceStarted;
    dayDigests.push(result.digest);
    if (result.summary.entrants !== expectedEntrantsPerDay) wrongEntrantDays.push(day);
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    if (day % options.sampleEvery === 0 || day === options.days) samples.push(createSample(simulation));
  }

  const primaryWallMs = performance.now() - primaryWallStarted;
  const snapshot = simulation.snapshot();
  const finalMetrics = simulation.metrics();
  const finalDigest = simulation.digest();
  const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  const invariants = auditInvariants(simulation, snapshot, finalMetrics, options, wrongEntrantDays);
  const replay = verifyReplay(options, dayDigests, finalDigest);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  const retainedEvents = snapshot.state.events;
  const lastSummary = snapshot.state.dailySummaries[snapshot.state.dailySummaries.length - 1] ?? null;

  const report: VerificationReport = {
    formatVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    parameters: {
      seed: options.seed,
      days: options.days,
      sampleEvery: options.sampleEvery,
      replayEnabled: options.verifyReplay,
      snapshotRoundtripEnabled: options.verifyRoundtrip,
      roundtripDay: options.verifyRoundtrip ? options.roundtripDay : null,
    },
    simulation: {
      schemaVersion: snapshot.schemaVersion,
      engineVersion: snapshot.engineVersion,
      simulationRevision: simulationRevision(),
      finalDigest,
      snapshotDigest: snapshot.digest,
      snapshotBytes,
    },
    runtime: {
      nodeVersion: process.version,
      platform: platform(),
      architecture: arch(),
      osRelease: release(),
      logicalCpuCount: cpus().length,
      totalMemoryGiB: round(totalmem() / 1024 ** 3, 2),
    },
    performance: {
      primaryAdvanceMs: round(primaryAdvanceMs),
      primaryWallMs: round(primaryWallMs),
      meanAdvanceMsPerDay: round(primaryAdvanceMs / options.days, 4),
      simulatedDaysPerSecond: round(options.days / (primaryAdvanceMs / 1000), 2),
      peakRssBytes,
      finalRssBytes: process.memoryUsage().rss,
    },
    invariants,
    replay,
    samples,
    finalMetrics,
    finalDailySummary: lastSummary,
    eventWindow: {
      retainedEvents: retainedEvents.length,
      totalEventSequence: snapshot.state.eventSequence,
      historyTruncated: snapshot.state.eventSequence > retainedEvents.length,
      firstRetainedSequence: retainedEvents[0]?.sequence ?? null,
      lastRetainedSequence: retainedEvents[retainedEvents.length - 1]?.sequence ?? null,
      retainedTypeCounts: countEventTypes(snapshot),
    },
  };

  if (options.out !== null) {
    const outputPath = resolve(options.out);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(`The Current — deterministic headless verification`);
  console.log(`Seed ${options.seed} · ${options.days} days · digest ${finalDigest}`);
  console.log(`Population ${finalMetrics.population} · births ${finalMetrics.births} · deaths ${finalMetrics.deaths} · entrants ${finalMetrics.totalEntrants}`);
  console.log(`Housing ${finalMetrics.occupiedHousing}/${finalMetrics.housingCapacity} · partnerships ${finalMetrics.partnerships} · inheritance ${finalMetrics.inheritedValue}`);
  console.log(`Advance ${round(primaryAdvanceMs)} ms (${round(options.days / (primaryAdvanceMs / 1000), 2)} world-days/s) · snapshot ${snapshotBytes} bytes`);
  console.log(`Invariants ${invariants.passed ? 'PASS' : 'FAIL'} (${invariants.passedChecks}/${invariants.totalChecks}) · replay ${replay.enabled ? replay.passed ? 'PASS' : 'FAIL' : 'SKIPPED'}`);
  if (options.out !== null) console.log(`Report written to ${options.out}`);

  if (!invariants.passed || replay.passed === false) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Headless verification failed: ${message}`);
  console.error('Use --help for command options.');
  process.exitCode = 2;
});
