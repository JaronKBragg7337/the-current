import { describe, expect, it } from 'vitest';

import {
  canonicalDigest,
  createSimulation,
  footprintRect,
  restoreSimulation,
  type Person,
  type Position3,
  type WorldSnapshot,
  type WorldState,
} from '../../src/simulation';

function mutatedSimulation(snapshot: WorldSnapshot, mutate: (state: WorldState) => void) {
  const changed = structuredClone(snapshot);
  mutate(changed.state);
  changed.digest = canonicalDigest(changed.state);
  return restoreSimulation(changed);
}

function configureForWork(person: Person, occupation: Person['occupation']): void {
  person.occupation = occupation;
  person.employed = true;
  person.health = 100;
  person.needs = { energy: 100, food: 100, health: 100, safety: 100, shelter: 100, social: 100, water: 100 };
  person.traits.sociability = 0;
}

function offset(position: Position3, distance: number): Position3 {
  return { x: position.x + distance, y: position.y, z: position.z + distance };
}

function relationshipId(leftId: string, rightId: string): string {
  return leftId < rightId ? `relationship:${leftId}:${rightId}` : `relationship:${rightId}:${leftId}`;
}

describe('physical causality', () => {
  it('delivers a newborn at the mother household home and keeps the newborn there for care', () => {
    const source = createSimulation({ seed: 'birth-location', config: { entrantsPerDay: 0 } });
    const sourceSnapshot = source.snapshot();
    const people = Object.values(sourceSnapshot.state.people);
    const mother = people.find((person) => person.biologicalSex === 'female');
    const father = people.find((person) => person.biologicalSex === 'male');
    expect(mother).toBeDefined();
    expect(father).toBeDefined();
    expect(mother?.homeBuildingId).not.toBeNull();

    const motherId = mother?.id ?? '';
    const fatherId = father?.id ?? '';
    const homeId = mother?.homeBuildingId ?? '';
    const expectedPosition = structuredClone(sourceSnapshot.state.buildings[homeId]?.position);
    expect(expectedPosition).toBeDefined();

    const simulation = mutatedSimulation(sourceSnapshot, (state) => {
      const changedMother = state.people[motherId];
      if (changedMother === undefined) throw new Error('Expected mother');
      changedMother.pregnancy = { conceivedDay: 0, dueDay: 1, otherParentId: fatherId };
    });
    const result = simulation.advanceDay();
    const child = Object.values(simulation.snapshot().state.people).find((person) => person.origin === 'born');
    const birth = result.events.find((event) => event.type === 'birth');

    expect(child).toBeDefined();
    expect(child?.position).toEqual(expectedPosition);
    expect(child?.destination).toEqual(expectedPosition);
    expect(child?.currentTask).toBe('care');
    expect(birth?.data).toMatchObject({ birthLocation: 'home', homeBuildingId: homeId });
    expect(birth?.data.x).toBe(expectedPosition?.x);
    expect(birth?.data.z).toBe(expectedPosition?.z);
  });

  it('allows shared-work encounters at an arrived worksite but not between nonlocal coworkers in transit', () => {
    const source = createSimulation({ seed: 'encounter-location', config: { entrantsPerDay: 0, initialPopulation: 4 } });
    const snapshot = source.snapshot();
    const [leftId, , rightId] = Object.keys(snapshot.state.people).sort();
    const firstFarm = Object.values(snapshot.state.buildings).find((building) => building.type === 'farm');
    expect(leftId).toBeDefined();
    expect(rightId).toBeDefined();
    expect(firstFarm).toBeDefined();
    const id = relationshipId(leftId ?? '', rightId ?? '');

    const atWorksite = mutatedSimulation(snapshot, (state) => {
      const left = state.people[leftId ?? ''];
      const right = state.people[rightId ?? ''];
      if (left === undefined || right === undefined || firstFarm === undefined) throw new Error('Missing encounter fixture');
      configureForWork(left, 'farmer');
      configureForWork(right, 'farmer');
      left.position = structuredClone(firstFarm.position);
      right.position = structuredClone(firstFarm.position);
    });
    atWorksite.advanceDay();
    expect(atWorksite.snapshot().state.relationships[id]?.kind).toBe('coworker');

    const inTransit = mutatedSimulation(snapshot, (state) => {
      const left = state.people[leftId ?? ''];
      const right = state.people[rightId ?? ''];
      if (left === undefined || right === undefined || firstFarm === undefined) throw new Error('Missing encounter fixture');
      configureForWork(left, 'farmer');
      configureForWork(right, 'farmer');
      left.position = offset(firstFarm.position, 500);
      right.position = offset(firstFarm.position, -500);
    });
    inTransit.advanceDay();
    expect(inTransit.snapshot().state.relationships[id]).toBeUndefined();
  });

  it('produces and pays only after an employed person reaches the occupation worksite', () => {
    const source = createSimulation({ seed: 'worksite-arrival', config: { entrantsPerDay: 0, initialPopulation: 1 } });
    const snapshot = source.snapshot();
    const personId = Object.keys(snapshot.state.people)[0] ?? '';
    const farm = Object.values(snapshot.state.buildings).find((building) => building.type === 'farm');
    expect(farm).toBeDefined();

    const present = mutatedSimulation(snapshot, (state) => {
      const person = state.people[personId];
      if (person === undefined || farm === undefined) throw new Error('Missing work fixture');
      configureForWork(person, 'farmer');
      person.position = structuredClone(farm.position);
    });
    present.advanceDay();

    const traveling = mutatedSimulation(snapshot, (state) => {
      const person = state.people[personId];
      if (person === undefined || farm === undefined) throw new Error('Missing work fixture');
      configureForWork(person, 'farmer');
      person.position = offset(farm.position, 500);
    });
    traveling.advanceDay();

    const presentState = present.snapshot().state;
    const travelingState = traveling.snapshot().state;
    expect(presentState.people[personId]?.currentTask).toBe('work');
    expect(travelingState.people[personId]?.currentTask).toBe('work');
    expect(presentState.settlement.dailyEconomy.production.food)
      .toBeGreaterThan(travelingState.settlement.dailyEconomy.production.food);
    expect(presentState.settlement.dailyEconomy.wagesPaid).toBeGreaterThan(0);
    expect(travelingState.settlement.dailyEconomy.wagesPaid).toBe(0);
    expect(travelingState.people[personId]?.lastTaskSuccess).toBe(false);
  });

  it('delivers materials and construction labor only from builders who reached their assigned project', () => {
    const source = createSimulation({
      seed: 'construction-arrival',
      config: {
        entrantsPerDay: 0,
        initialPopulation: 4,
        construction: { materialDeliveryPerWorker: 12 },
      },
    });
    const prepared = mutatedSimulation(source.snapshot(), (state) => {
      state.settlement.resources.food = 0;
      for (const person of Object.values(state.people)) configureForWork(person, 'artist');
    });
    prepared.advanceDay();
    const preparedSnapshot = prepared.snapshot();
    const project = Object.values(preparedSnapshot.state.buildings).find((building) => building.stage !== 'complete');
    const builderId = Object.keys(preparedSnapshot.state.people).sort()[0] ?? '';
    expect(project).toBeDefined();
    expect(project?.laborCompleted).toBe(0);

    const present = mutatedSimulation(preparedSnapshot, (state) => {
      const builder = state.people[builderId];
      if (builder === undefined || project === undefined) throw new Error('Missing construction fixture');
      configureForWork(builder, 'builder');
      builder.position = structuredClone(project.position);
    });
    const presentDay = present.advanceDay();

    const traveling = mutatedSimulation(preparedSnapshot, (state) => {
      const builder = state.people[builderId];
      if (builder === undefined || project === undefined) throw new Error('Missing construction fixture');
      configureForWork(builder, 'builder');
      builder.position = offset(project.position, 500);
    });
    const travelingDay = traveling.advanceDay();

    const presentProject = present.snapshot().state.buildings[project?.id ?? ''];
    const travelingProject = traveling.snapshot().state.buildings[project?.id ?? ''];
    const presentBuilder = present.snapshot().state.people[builderId];
    const delivered = (building: typeof presentProject) =>
      (building?.deliveredMaterials.stone ?? 0) + (building?.deliveredMaterials.tools ?? 0) + (building?.deliveredMaterials.wood ?? 0);
    expect(delivered(presentProject)).toBeGreaterThan(0);
    expect(presentProject?.laborCompleted).toBeGreaterThan(0);
    expect(presentDay.events.some((event) => event.type === 'material-delivered')).toBe(true);
    const constructionFootprint = project === undefined ? undefined : footprintRect(project.type, project.position);
    const builderIsOutsideProject = constructionFootprint === undefined || presentBuilder === undefined ||
      presentBuilder.position.x <= constructionFootprint.minX || presentBuilder.position.x >= constructionFootprint.maxX ||
      presentBuilder.position.z <= constructionFootprint.minZ || presentBuilder.position.z >= constructionFootprint.maxZ;
    expect(builderIsOutsideProject).toBe(true);
    expect(delivered(travelingProject)).toBe(0);
    expect(travelingProject?.laborCompleted).toBe(0);
    expect(travelingProject?.builderIds).toEqual([]);
    expect(travelingDay.events.some((event) => event.type === 'material-delivered')).toBe(false);
  });
});

describe('leadership follower networks', () => {
  it('persists election associations and keeps losing-candidate supporters off the winner', () => {
    const simulation = createSimulation({
      seed: 'candidate-associations',
      config: {
        entrantsPerDay: 0,
        leadership: { electionIntervalDays: 7, followerTrust: 0, minimumFollowers: 1 },
      },
    });
    simulation.advanceDay();
    const elected = simulation.snapshot().state;
    const council = Object.values(elected.institutions).find((institution) => institution.kind === 'council');
    expect(council?.leaderId).not.toBeNull();
    const associations = council?.followerCandidateIds ?? {};
    const supportedCandidates = new Set(Object.values(associations));
    expect(supportedCandidates.size).toBeGreaterThan(1);

    const losingSupporters = Object.entries(associations)
      .filter(([, candidateId]) => candidateId !== council?.leaderId)
      .map(([followerId]) => followerId);
    expect(losingSupporters.length).toBeGreaterThan(0);
    const leaderFollowers = elected.people[council?.leaderId ?? '']?.followersIds ?? [];
    for (const followerId of losingSupporters) expect(leaderFollowers).not.toContain(followerId);
    for (const [followerId, candidateId] of Object.entries(associations)) {
      expect(elected.people[candidateId]?.followersIds).toContain(followerId);
    }

    const loyalty = structuredClone(council?.followerLoyalty ?? {});
    simulation.advanceDay();
    const persisted = Object.values(simulation.snapshot().state.institutions)
      .find((institution) => institution.id === council?.id);
    expect(persisted?.followerCandidateIds).toEqual(associations);
    expect(persisted?.followerLoyalty).toEqual(loyalty);
    for (const [followerId, candidateId] of Object.entries(persisted?.followerCandidateIds ?? {})) {
      expect(simulation.inspectPerson(candidateId)?.followersIds).toContain(followerId);
    }
  });
});
