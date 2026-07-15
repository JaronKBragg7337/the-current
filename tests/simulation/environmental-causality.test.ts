import { describe, expect, it } from 'vitest';

import {
  canonicalDigest,
  createSimulation,
  restoreSimulation,
  type ObserverIntervention,
  type Person,
  type WorldSnapshot,
  type WorldState,
} from '../../src/simulation';

function mutatedSimulation(snapshot: WorldSnapshot, mutate: (state: WorldState) => void) {
  const changed = structuredClone(snapshot);
  mutate(changed.state);
  changed.digest = canonicalDigest(changed.state);
  return restoreSimulation(changed);
}

function configureSanitationWorker(person: Person): void {
  person.occupation = 'laborer';
  person.employed = true;
  person.health = 100;
  person.skills.construction = 100;
  person.needs = { energy: 100, food: 100, health: 100, safety: 100, shelter: 100, social: 100, water: 100 };
}

describe('environmental causality', () => {
  it('damages one deterministic well, its output, and the mixed drinking-water quality', () => {
    const affected = createSimulation({ seed: 'local-contamination', config: { entrantsPerDay: 0 } });
    const control = createSimulation({ seed: 'local-contamination', config: { entrantsPerDay: 0 } });
    const intervention: ObserverIntervention = {
      id: 'intervention:local-contamination',
      kind: 'sabotage',
      payloadType: 'contamination',
      effectiveDay: 1,
      amount: 90,
      intensity: 1,
      targetSettlementId: 'settlement:current',
      note: 'A deterministic local water shock.',
    };

    const result = affected.advanceDay({ signals: [], interventions: [intervention] });
    control.advanceDay();
    const affectedState = affected.snapshot().state;
    const controlState = control.snapshot().state;
    const changedWells = Object.values(affectedState.buildings).filter((building) => {
      const baseline = controlState.buildings[building.id];
      return building.type === 'well' && baseline !== undefined &&
        building.environment.contamination > baseline.environment.contamination;
    });

    expect(changedWells).toHaveLength(1);
    expect(affectedState.settlement.dailyEconomy.production.water)
      .toBeLessThan(controlState.settlement.dailyEconomy.production.water);
    expect(affectedState.settlement.drinkingWaterQuality).toBeLessThan(controlState.settlement.drinkingWaterQuality);
    expect(result.events.some((event) => event.type === 'environment-degraded')).toBe(true);
  });

  it('requires arrival at a named sanitation site and changes that site rather than a distant patch', () => {
    const source = createSimulation({ seed: 'sanitation-arrival', config: { entrantsPerDay: 0, initialPopulation: 6 } });
    const snapshot = source.snapshot();
    const target = Object.values(snapshot.state.buildings).find((building) => building.type === 'warehouse');
    const workerIds = Object.keys(snapshot.state.people).sort();
    expect(target).toBeDefined();

    const prepare = (state: WorldState, distant: boolean) => {
      for (const building of Object.values(state.buildings)) building.environment.wasteLoad = 0;
      const changedTarget = state.buildings[target?.id ?? ''];
      if (changedTarget === undefined) throw new Error('Missing sanitation target');
      changedTarget.environment.wasteLoad = 30;
      state.settlement.waste = 30;
      state.settlement.resources.energy = 500;
      state.settlement.resources.transport = 50;
      for (const workerId of workerIds) {
        const worker = state.people[workerId];
        if (worker === undefined) continue;
        configureSanitationWorker(worker);
        if (distant) worker.position = { x: changedTarget.position.x + 500, y: 0, z: changedTarget.position.z + 500 };
      }
    };
    const arrived = mutatedSimulation(snapshot, (state) => prepare(state, false));
    const distant = mutatedSimulation(snapshot, (state) => prepare(state, true));
    const arrivedResult = arrived.advanceDay();
    distant.advanceDay();
    const arrivedState = arrived.snapshot().state;
    const distantState = distant.snapshot().state;

    expect(arrivedState.settlement.dailyEconomy.wasteRemoved).toBeGreaterThan(0);
    expect(distantState.settlement.dailyEconomy.wasteRemoved).toBe(0);
    expect(arrivedState.buildings[target?.id ?? '']?.environment.wasteLoad)
      .toBeLessThan(distantState.buildings[target?.id ?? '']?.environment.wasteLoad ?? 0);
    expect(arrivedResult.events.some((event) => event.type === 'sanitation-cleanup')).toBe(true);
  });

  it('uses energy to strengthen cleanup while keeping transport as durable capacity', () => {
    const source = createSimulation({
      seed: 'powered-sanitation',
      config: {
        entrantsPerDay: 0,
        initialPopulation: 8,
        environment: { sanitationEnergyPerWaste: 20 },
      },
    });
    const snapshot = source.snapshot();
    const target = Object.values(snapshot.state.buildings).find((building) => building.type === 'warehouse');
    const prepare = (state: WorldState, energy: number) => {
      for (const building of Object.values(state.buildings)) building.environment.wasteLoad = 0;
      const changedTarget = state.buildings[target?.id ?? ''];
      if (changedTarget === undefined) throw new Error('Missing sanitation target');
      changedTarget.environment.wasteLoad = 50;
      state.settlement.waste = 50;
      state.settlement.resources.energy = energy;
      state.settlement.resources.transport = 17;
      for (const person of Object.values(state.people)) configureSanitationWorker(person);
    };
    const powered = mutatedSimulation(snapshot, (state) => prepare(state, 2_000));
    const manual = mutatedSimulation(snapshot, (state) => prepare(state, 0));

    powered.advanceDay();
    manual.advanceDay();
    const poweredState = powered.snapshot().state;
    const manualState = manual.snapshot().state;
    expect(poweredState.settlement.dailyEconomy.wasteRemoved)
      .toBeGreaterThan(manualState.settlement.dailyEconomy.wasteRemoved);
    expect(poweredState.settlement.resources.transport).toBe(17);
    expect(manualState.settlement.resources.transport).toBe(17);
  });

  it('migrates legacy global waste into deterministic local patches before resuming', () => {
    const legacy = createSimulation({ seed: 'legacy-environment', config: { entrantsPerDay: 0 } }).snapshot();
    const legacyState = legacy.state as unknown as Record<string, unknown>;
    const settlement = legacy.state.settlement as unknown as Record<string, unknown>;
    delete settlement.drinkingWaterQuality;
    legacy.state.settlement.waste = 24;
    delete (legacy.state.settlement.dailyEconomy as unknown as Record<string, unknown>).wasteRemoved;
    for (const building of Object.values(legacy.state.buildings)) {
      delete (building as unknown as Record<string, unknown>).environment;
    }
    legacyState.engineVersion = '0.1.0';
    legacy.digest = canonicalDigest(legacy.state);

    const left = restoreSimulation(legacy);
    const right = restoreSimulation(legacy);
    const localizedWaste = Object.values(left.snapshot().state.buildings)
      .reduce((sum, building) => sum + building.environment.wasteLoad, 0);
    expect(localizedWaste).toBeCloseTo(24, 3);
    expect(left.digest()).toBe(right.digest());
    expect(left.advanceDay().digest).toBe(right.advanceDay().digest);
  });

  it('preserves a hysteretic recovery-margin status across snapshot restore', () => {
    const snapshot = createSimulation({ seed: 'environment-status-roundtrip', config: { entrantsPerDay: 0 } }).snapshot();
    const site = Object.values(snapshot.state.buildings).find((building) => building.type === 'house');
    if (site === undefined) throw new Error('Missing status test site');
    site.environment = {
      contamination: 20,
      fertility: 78,
      status: 'stressed',
      wasteLoad: 4.5,
      waterQuality: 92,
    };
    snapshot.digest = canonicalDigest(snapshot.state);

    const restored = restoreSimulation(snapshot);
    expect(restored.snapshot().state.buildings[site.id]?.environment.status).toBe('stressed');
    expect(restored.snapshot().digest).toBe(snapshot.digest);
  });

  it('inherits polluted nearby land when the town commissions a new site', () => {
    const source = createSimulation({ seed: 'polluted-building-site', config: { entrantsPerDay: 0 } });
    const simulation = mutatedSimulation(source.snapshot(), (state) => {
      state.settlement.resources.food = 0;
      for (const building of Object.values(state.buildings)) {
        building.environment.contamination = 65;
        building.environment.waterQuality = 35;
        building.environment.status = 'hazardous';
      }
    });
    simulation.advanceDay();
    const commissioned = Object.values(simulation.snapshot().state.buildings)
      .find((building) => building.commissionedDay === 1 && building.stage !== 'complete');
    expect(commissioned).toBeDefined();
    expect(commissioned?.environment.contamination).toBeGreaterThan(40);
    expect(commissioned?.environment.waterQuality).toBeLessThan(55);
  });

  it('does not apply dirty-water exposure to residents who receive no water', () => {
    const source = createSimulation({ seed: 'no-water-no-exposure', config: { entrantsPerDay: 0, initialPopulation: 4 } });
    const prepare = (state: WorldState, drinkingWaterQuality: number) => {
      state.settlement.resources.water = 0;
      state.settlement.drinkingWaterQuality = drinkingWaterQuality;
      for (const building of Object.values(state.buildings)) {
        building.environment = {
          contamination: 0,
          fertility: 80,
          status: 'healthy',
          wasteLoad: 0,
          waterQuality: 100,
        };
        if (building.type === 'well') {
          building.stage = 'planned';
          building.stageIndex = 0;
          building.stageProgress = 0;
          building.laborCompleted = 0;
          building.builderIds = [];
        }
      }
      state.settlement.waste = 0;
      for (const person of Object.values(state.people)) {
        person.employed = true;
        person.occupation = 'artist';
        person.health = 100;
        person.needs = { energy: 100, food: 100, health: 100, safety: 100, shelter: 100, social: 100, water: 100 };
      }
    };
    const polluted = mutatedSimulation(source.snapshot(), (state) => prepare(state, 10));
    const clean = mutatedSimulation(source.snapshot(), (state) => prepare(state, 100));

    polluted.advanceDay();
    clean.advanceDay();
    const pollutedHealth = Object.values(polluted.snapshot().state.people).map((person) => person.health);
    const cleanHealth = Object.values(clean.snapshot().state.people).map((person) => person.health);
    expect(polluted.snapshot().state.settlement.dailyEconomy.consumption.water).toBe(0);
    expect(pollutedHealth).toEqual(cleanHealth);
  });

  it('keeps hunter output out of farm production pressure', () => {
    const source = createSimulation({ seed: 'local-farm-production', config: { entrantsPerDay: 0, initialPopulation: 1 } });
    const prepare = (state: WorldState, occupation: 'artist' | 'hunter') => {
      for (const building of Object.values(state.buildings)) {
        building.environment.wasteLoad = 0;
      }
      state.settlement.waste = 0;
      const person = Object.values(state.people)[0];
      if (person === undefined) throw new Error('Missing production worker');
      person.employed = true;
      person.occupation = occupation;
      person.health = 100;
      person.needs = { energy: 100, food: 100, health: 100, safety: 100, shelter: 100, social: 100, water: 100 };
      for (const skill of Object.keys(person.skills) as (keyof Person['skills'])[]) person.skills[skill] = 100;
    };
    const hunter = mutatedSimulation(source.snapshot(), (state) => prepare(state, 'hunter'));
    const artist = mutatedSimulation(source.snapshot(), (state) => prepare(state, 'artist'));

    hunter.advanceDay();
    artist.advanceDay();
    const hunterState = hunter.snapshot().state;
    const artistState = artist.snapshot().state;
    expect(hunterState.settlement.dailyEconomy.production.food)
      .toBeGreaterThan(artistState.settlement.dailyEconomy.production.food);
    const farmFertility = (state: WorldState) => Object.values(state.buildings)
      .filter((building) => building.type === 'farm')
      .map((building) => building.environment.fertility);
    expect(farmFertility(hunterState)).toEqual(farmFertility(artistState));
  });

  it('does not deposit industrial source waste at an incomplete workshop', () => {
    const source = createSimulation({ seed: 'inactive-workshop-waste', config: { entrantsPerDay: 0, initialPopulation: 1 } });
    const incompleteId = 'building:9000';
    const simulation = mutatedSimulation(source.snapshot(), (state) => {
      for (const building of Object.values(state.buildings)) building.environment.wasteLoad = 0;
      state.settlement.waste = 0;
      const completeWorkshop = Object.values(state.buildings).find((building) => building.type === 'workshop');
      if (completeWorkshop === undefined) throw new Error('Missing source workshop');
      const incomplete = structuredClone(completeWorkshop);
      incomplete.id = incompleteId;
      incomplete.name = 'unfinished workshop';
      incomplete.position = { x: 1_000, y: 0, z: 1_000 };
      incomplete.stage = 'planned';
      incomplete.stageIndex = 0;
      incomplete.stageProgress = 0;
      incomplete.laborCompleted = 0;
      incomplete.builderIds = [];
      incomplete.occupiedByIds = [];
      incomplete.environment.wasteLoad = 0;
      state.buildings[incompleteId] = incomplete;
      state.settlement.buildingIds.push(incompleteId);
      state.settlement.buildingIds.sort();
      state.settlement.constructionQueue.push(incompleteId);
      state.settlement.constructionQueue.sort();
    });

    simulation.advanceDay();
    const state = simulation.snapshot().state;
    const completeWorkshop = Object.values(state.buildings)
      .find((building) => building.type === 'workshop' && building.stage === 'complete');
    expect(state.settlement.dailyEconomy.production.tools).toBeGreaterThan(0);
    expect(completeWorkshop?.environment.wasteLoad).toBeGreaterThan(0);
    expect(state.buildings[incompleteId]?.environment.wasteLoad).toBe(0);
  });
});
