import { describe, expect, it } from 'vitest';

import { createSimulation } from '../../src/simulation';

/**
 * A world meant to run forever with no interventions must keep age and world
 * time coherent. These checks encode the guarantees the spectator UI and the
 * historical record both depend on, so a future regression surfaces here rather
 * than as a person who claims to be older than the world itself.
 */
describe('age and world-time consistency', () => {
  const simulation = createSimulation({ seed: 'age-consistency-001' });
  // Live chronology uses real day units, so this horizon is long enough for
  // migration, mature partnerships, gestation, and at least one native birth
  // without compressing human lifespans merely to satisfy a test.
  for (let day = 0; day < 500; day += 1) simulation.advanceDay();
  const state = simulation.snapshot().state;
  const people = Object.values(state.people);
  const { day } = state;
  const { entrantAge, lifespan } = state.config;

  it('derives age from birth day — advancing for the living, frozen at death for the dead', () => {
    for (const person of people) {
      const referenceDay = person.alive ? day : person.deathDay ?? day;
      expect(person.ageDays).toBe(referenceDay - person.birthDay);
    }
  });

  it('never lets a native-born person be older than the world', () => {
    const natives = people.filter((person) => person.origin === 'born');
    expect(natives.length).toBeGreaterThan(0);
    for (const person of natives) {
      expect(person.birthDay).toBeGreaterThanOrEqual(0);
      expect(person.ageDays).toBeLessThanOrEqual(day);
      expect(person.arrivalDay).toBe(person.birthDay);
    }
  });

  it('gives immigrants a coherent pre-arrival history within the configured entry age', () => {
    const immigrants = people.filter((person) => person.origin === 'entrant');
    expect(immigrants.length).toBeGreaterThan(0);
    for (const person of immigrants) {
      const ageAtArrival = person.arrivalDay - person.birthDay;
      expect(ageAtArrival).toBeGreaterThanOrEqual(entrantAge.min);
      expect(ageAtArrival).toBeLessThanOrEqual(entrantAge.max);
    }
  });

  it('holds everyone to the same human lifespan measured from birth', () => {
    for (const person of people) {
      const totalLifespan = person.naturalDeathDay - person.birthDay;
      expect(totalLifespan).toBeGreaterThanOrEqual(lifespan.min);
      expect(totalLifespan).toBeLessThanOrEqual(lifespan.max);
      // No one is scheduled to die before they have arrived.
      expect(person.naturalDeathDay).toBeGreaterThan(person.arrivalDay);
    }
  });

  it('bounds every recorded natural-death age by the human ceiling', () => {
    const naturalDeaths = people.filter(
      (person) => !person.alive && person.deathCause === 'natural causes',
    );
    for (const person of naturalDeaths) {
      const ageAtDeath = (person.deathDay ?? day) - person.birthDay;
      expect(ageAtDeath).toBeLessThanOrEqual(lifespan.max);
    }
  });
});
