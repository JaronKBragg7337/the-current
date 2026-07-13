import { describe, expect, it } from 'vitest';

import {
  createSimulation,
  type DayInputs,
  type NormalizedSignal,
  type ObserverIntervention,
} from '../../src/simulation';

const foodShock: NormalizedSignal = {
  id: 'signal:food-shock',
  sourceIds: ['source:official-a', 'source:official-b'],
  domain: 'agriculture',
  geography: 'global',
  intensity: 0.8,
  confidence: 0.9,
  sourceAgreement: 0.75,
  novelty: 0.7,
  durationDays: 5,
  halfLifeDays: 2,
  timestampDay: 0,
  effectiveDay: 1,
  objectivePressure: { food: 0.9, trade: 0.2 },
  beliefPressure: { sentiment: 0.35 },
};

const foodAid: ObserverIntervention = {
  id: 'intervention:food-aid',
  kind: 'help',
  payloadType: 'food',
  effectiveDay: 1,
  amount: 120,
  intensity: 0.8,
  targetSettlementId: 'settlement:confluence',
  note: 'A limited observer food shipment, interpreted through local institutions.',
};

describe('causal civilization systems', () => {
  it('normalizes queued information and resolves observer help inside the economy', () => {
    const affected = createSimulation({ seed: 'causal-inputs' });
    const control = createSimulation({ seed: 'causal-inputs' });
    const inputs: DayInputs = { signals: [foodShock], interventions: [foodAid] };

    const result = affected.advanceDay(inputs);
    control.advanceDay();

    expect(result.events.some((event) => event.type === 'signal-received')).toBe(true);
    expect(result.events.some((event) => event.type === 'intervention-resolved')).toBe(true);
    expect(affected.projection().pressure.food).toBeGreaterThan(0);
    expect(affected.metrics().activeSignals).toBe(1);
    expect(affected.metrics().resolvedInterventions).toBe(1);
    expect(affected.projection().resources.food).toBeGreaterThan(control.projection().resources.food);

    const record = affected.snapshot().state.interventions[0];
    expect(record?.resolvedDay).toBe(1);
    expect(record?.outcome).toMatch(/delivered/i);
  });

  it('sorts same-day causal inputs so caller order cannot change history', () => {
    const secondSignal: NormalizedSignal = {
      ...foodShock,
      id: 'signal:energy-shock',
      domain: 'energy',
      objectivePressure: { energy: 0.6 },
    };
    const festival: ObserverIntervention = {
      ...foodAid,
      id: 'intervention:festival',
      kind: 'spice',
      payloadType: 'festival',
      amount: 30,
    };
    const forward = createSimulation({ seed: 'input-order' });
    const reverse = createSimulation({ seed: 'input-order' });

    forward.advanceDay({ signals: [foodShock, secondSignal], interventions: [foodAid, festival] });
    reverse.advanceDay({ signals: [secondSignal, foodShock], interventions: [festival, foodAid] });

    expect(forward.digest()).toBe(reverse.digest());
  });

  it('models breakthroughs as attempts, experiments, demonstrations, and adoption', () => {
    const simulation = createSimulation({
      seed: 'forced-breakthrough-path',
      config: {
        rarity: { strongLeader: 0, powerSeeker: 0, polymath: 0, exceptional: 1 },
        breakthroughs: {
          attemptIntervalDays: 1,
          minimumKnowledge: 0,
          baseProgress: 100,
          failureChance: 0,
        },
      },
    });

    simulation.advanceDays(25);
    const metrics = simulation.metrics();
    const events = simulation.eventsSince(0);

    expect(metrics.breakthroughAttempts).toBeGreaterThan(0);
    expect(metrics.breakthroughAdoptions).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'breakthrough-attempt')).toBe(true);
    expect(events.some((event) => event.type === 'breakthrough-progress')).toBe(true);
    expect(events.some((event) => event.type === 'breakthrough-adopted')).toBe(true);
    expect(Object.values(simulation.snapshot().state.breakthroughs).some((item) => item.stage === 'adopted')).toBe(true);
  });
});
