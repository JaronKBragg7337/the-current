import { useEffect, useId, useState } from 'react';

import type { ObserverIntervention } from '../simulation/types';

export interface ObserverInterventionsProps {
  currentDay: number;
  targetSettlementId: string;
  onSubmitIntervention: (intervention: ObserverIntervention) => Promise<void>;
  initialEnergy?: number;
  energyCapacity?: number;
  energyRegenerationPerDay?: number;
  disabled?: boolean;
}

type InterventionActionId =
  | 'education-grant'
  | 'false-information'
  | 'festival'
  | 'food-drop'
  | 'infrastructure-failure'
  | 'rare-discovery'
  | 'trade-obstruction'
  | 'water-drop'
  | 'mysterious-broadcast';

interface InterventionAction {
  readonly id: InterventionActionId;
  readonly kind: ObserverIntervention['kind'];
  readonly payloadType: ObserverIntervention['payloadType'];
  readonly label: string;
  readonly summary: string;
  readonly mixedConsequence: string;
  readonly energyCost: number;
  readonly cooldownDays: number;
  readonly effectiveDelayDays: number;
  readonly amount: number;
  readonly intensity: number;
}

interface BudgetState {
  readonly energy: number;
  readonly accountedDay: number;
  readonly cooldownUntil: Readonly<Partial<Record<InterventionActionId, number>>>;
}

const INTERVENTION_ACTIONS = [
  {
    id: 'food-drop',
    kind: 'help',
    payloadType: 'food',
    label: 'Food shipment',
    summary: 'Introduce a limited food shipment through the settlement economy.',
    mixedConsequence:
      'It may prevent hunger, but diversion, dependency, waste, or falling farm prices can follow.',
    energyCost: 3,
    cooldownDays: 3,
    effectiveDelayDays: 1,
    amount: 28,
    intensity: 0.55,
  },
  {
    id: 'water-drop',
    kind: 'help',
    payloadType: 'water',
    label: 'Emergency water',
    summary: 'Route a finite water reserve into local distribution.',
    mixedConsequence:
      'It may protect health, but unequal access, resale, or delayed infrastructure investment can result.',
    energyCost: 2,
    cooldownDays: 2,
    effectiveDelayDays: 1,
    amount: 36,
    intensity: 0.5,
  },
  {
    id: 'education-grant',
    kind: 'help',
    payloadType: 'education-funding',
    label: 'Education grant',
    summary: 'Offer funding that an existing school or institution may use.',
    mixedConsequence:
      'It may expand knowledge, but leaders can redirect it or concentrate opportunity among allies.',
    energyCost: 4,
    cooldownDays: 5,
    effectiveDelayDays: 2,
    amount: 22,
    intensity: 0.6,
  },
  {
    id: 'festival',
    kind: 'spice',
    payloadType: 'festival',
    label: 'Festival',
    summary: 'Seed a public occasion that residents may embrace, reshape, or ignore.',
    mixedConsequence:
      'It may strengthen social ties while consuming labor, amplifying factions, or excluding outsiders.',
    energyCost: 2,
    cooldownDays: 4,
    effectiveDelayDays: 1,
    amount: 8,
    intensity: 0.65,
  },
  {
    id: 'rare-discovery',
    kind: 'spice',
    payloadType: 'rare-discovery',
    label: 'Rare discovery',
    summary: 'Place unusual materials and incomplete technical clues into circulation.',
    mixedConsequence:
      'It may inspire research, but can create monopoly, dangerous experiments, fraud, or political rivalry.',
    energyCost: 5,
    cooldownDays: 7,
    effectiveDelayDays: 2,
    amount: 12,
    intensity: 0.72,
  },
  {
    id: 'mysterious-broadcast',
    kind: 'spice',
    payloadType: 'mysterious-broadcast',
    label: 'Mysterious broadcast',
    summary: 'Release an ambiguous transmission into the settlement information network.',
    mixedConsequence:
      'It may spark art or inquiry, but can also produce panic, opportunism, or competing interpretations.',
    energyCost: 3,
    cooldownDays: 5,
    effectiveDelayDays: 1,
    amount: 6,
    intensity: 0.58,
  },
  {
    id: 'false-information',
    kind: 'sabotage',
    payloadType: 'false-information',
    label: 'False information',
    summary: 'Introduce a contestable false claim; nobody is forced to believe it.',
    mixedConsequence:
      'It may damage trust, but scrutiny can expose manipulators, strengthen verification, or unite rivals.',
    energyCost: 4,
    cooldownDays: 6,
    effectiveDelayDays: 1,
    amount: 7,
    intensity: 0.65,
  },
  {
    id: 'trade-obstruction',
    kind: 'sabotage',
    payloadType: 'trade-obstruction',
    label: 'Trade obstruction',
    summary: 'Add friction to transport and exchange without dictating a response.',
    mixedConsequence:
      'It may cause scarcity and unemployment, but can also encourage local production or new alliances.',
    energyCost: 5,
    cooldownDays: 7,
    effectiveDelayDays: 2,
    amount: 5,
    intensity: 0.7,
  },
  {
    id: 'infrastructure-failure',
    kind: 'sabotage',
    payloadType: 'infrastructure-failure',
    label: 'Infrastructure failure',
    summary: 'Create a bounded equipment or building failure inside the causal system.',
    mixedConsequence:
      'It may injure prosperity, but can reveal negligence, trigger reform, or accelerate resilient design.',
    energyCost: 6,
    cooldownDays: 9,
    effectiveDelayDays: 2,
    amount: 0.32,
    intensity: 0.7,
  },
] as const satisfies readonly InterventionAction[];

const INTERVENTION_KINDS = ['help', 'spice', 'sabotage'] as const;
const BUDGET_STORAGE_KEY = 'the-current.observer-budget.v1';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function energyOnDay(
  budget: BudgetState,
  currentDay: number,
  capacity: number,
  regenerationPerDay: number,
): number {
  const elapsedDays = Math.max(0, currentDay - budget.accountedDay);
  return clamp(budget.energy + elapsedDays * regenerationPerDay, 0, capacity);
}

function loadStoredBudget(
  currentDay: number,
  initialEnergy: number,
  capacity: number,
): BudgetState {
  const fallback: BudgetState = {
    energy: clamp(initialEnergy, 0, capacity),
    accountedDay: currentDay,
    cooldownUntil: {},
  };
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(BUDGET_STORAGE_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.energy !== 'number'
      || !Number.isFinite(candidate.energy)
      || typeof candidate.accountedDay !== 'number'
      || !Number.isSafeInteger(candidate.accountedDay)
      || candidate.accountedDay < 0
      || typeof candidate.cooldownUntil !== 'object'
      || candidate.cooldownUntil === null
      || Array.isArray(candidate.cooldownUntil)
    ) {
      return fallback;
    }
    const cooldownUntil: Partial<Record<InterventionActionId, number>> = {};
    for (const action of INTERVENTION_ACTIONS) {
      const day = (candidate.cooldownUntil as Record<string, unknown>)[action.id];
      if (typeof day === 'number' && Number.isSafeInteger(day) && day >= 0) {
        cooldownUntil[action.id] = day;
      }
    }
    return {
      energy: clamp(candidate.energy, 0, capacity),
      accountedDay: Math.min(candidate.accountedDay, currentDay),
      cooldownUntil,
    };
  } catch {
    return fallback;
  }
}

function createInterventionId(actionId: InterventionActionId, currentDay: number): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `observer:${currentDay}:${actionId}:${randomPart}`;
}

export function ObserverInterventions({
  currentDay,
  targetSettlementId,
  onSubmitIntervention,
  initialEnergy = 12,
  energyCapacity = 12,
  energyRegenerationPerDay = 1,
  disabled = false,
}: ObserverInterventionsProps) {
  const componentId = useId();
  const headingId = `${componentId}-title`;
  const energyLabelId = `${componentId}-energy-label`;
  const noteId = `${componentId}-note`;
  const capacity = Math.max(1, energyCapacity);
  const regenerationPerDay = Math.max(0, energyRegenerationPerDay);
  const [budget, setBudget] = useState<BudgetState>(() =>
    loadStoredBudget(currentDay, initialEnergy, capacity),
  );
  const [note, setNote] = useState('');
  const [pendingActionId, setPendingActionId] = useState<InterventionActionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const availableEnergy = energyOnDay(budget, currentDay, capacity, regenerationPerDay);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
    } catch {
      // Storage can be unavailable; the mounted component still enforces the budget.
    }
  }, [budget]);

  async function submitAction(action: InterventionAction): Promise<void> {
    const cooldownUntil = budget.cooldownUntil[action.id] ?? 0;
    if (
      disabled ||
      pendingActionId !== null ||
      currentDay < cooldownUntil ||
      availableEnergy < action.energyCost
    ) {
      return;
    }

    setPendingActionId(action.id);
    setError(null);
    setStatus(null);
    const intervention: ObserverIntervention = {
      id: createInterventionId(action.id, currentDay),
      kind: action.kind,
      payloadType: action.payloadType,
      effectiveDay: currentDay + action.effectiveDelayDays,
      amount: action.amount,
      intensity: action.intensity,
      targetSettlementId,
      note: note.trim() === '' ? action.mixedConsequence : note.trim().slice(0, 240),
    };

    try {
      await onSubmitIntervention(intervention);
      setBudget((previous) => ({
        energy:
          energyOnDay(previous, currentDay, capacity, regenerationPerDay) - action.energyCost,
        accountedDay: currentDay,
        cooldownUntil: {
          ...previous.cooldownUntil,
          [action.id]: currentDay + action.cooldownDays,
        },
      }));
      setStatus(
        `${action.label} queued for world day ${intervention.effectiveDay}. Residents retain agency over every consequence.`,
      );
      setNote('');
    } catch {
      setError('The intervention could not be queued. No observer energy was spent.');
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <section className="observer-interventions" aria-labelledby={headingId}>
      <header>
        <p className="eyebrow">Limited influence</p>
        <h2 id={headingId}>Observer interventions</h2>
        <p>
          Interventions enter the same economy, institutions, and information networks as every
          other event. Help can create dependency; disruption can provoke cooperation. There is no
          moral score and no guaranteed outcome.
        </p>
      </header>

      <div className="observer-energy" aria-labelledby={energyLabelId}>
        <strong id={energyLabelId}>Shared intervention energy</strong>
        <meter min={0} max={capacity} value={availableEnergy}>
          {availableEnergy} of {capacity}
        </meter>
        <span>
          {availableEnergy.toFixed(1)} / {capacity} · restores {regenerationPerDay} per world day
        </span>
      </div>

      <label htmlFor={noteId}>Optional context note</label>
      <textarea
        id={noteId}
        value={note}
        maxLength={240}
        rows={2}
        disabled={disabled || pendingActionId !== null}
        onChange={(event) => setNote(event.currentTarget.value)}
        placeholder="Recorded with the intervention; it does not command an NPC."
      />

      {INTERVENTION_KINDS.map((kind) => (
        <fieldset key={kind} disabled={disabled || pendingActionId !== null}>
          <legend>{kind[0]?.toUpperCase()}{kind.slice(1)}</legend>
          <div className="intervention-actions">
            {INTERVENTION_ACTIONS.filter((action) => action.kind === kind).map((action) => {
              const availableOnDay = budget.cooldownUntil[action.id] ?? 0;
              const cooldownRemaining = Math.max(0, availableOnDay - currentDay);
              const lacksEnergy = availableEnergy < action.energyCost;
              const unavailable = cooldownRemaining > 0 || lacksEnergy;
              const descriptionId = `${componentId}-${action.id}-description`;

              return (
                <article key={action.id} className={`intervention-action intervention-${kind}`}>
                  <h3>{action.label}</h3>
                  <p id={descriptionId}>{action.summary}</p>
                  <p><strong>Mixed consequences:</strong> {action.mixedConsequence}</p>
                  <dl>
                    <div><dt>Energy</dt><dd>{action.energyCost}</dd></div>
                    <div><dt>Cooldown</dt><dd>{action.cooldownDays} world days</dd></div>
                    <div><dt>Effect</dt><dd>World day {currentDay + action.effectiveDelayDays}</dd></div>
                  </dl>
                  <button
                    type="button"
                    disabled={unavailable}
                    aria-describedby={descriptionId}
                    onClick={() => {
                      void submitAction(action);
                    }}
                  >
                    {pendingActionId === action.id
                      ? 'Queueing…'
                      : cooldownRemaining > 0
                        ? `Ready in ${cooldownRemaining} day${cooldownRemaining === 1 ? '' : 's'}`
                        : lacksEnergy
                          ? 'Not enough energy'
                          : `Spend ${action.energyCost} energy`}
                  </button>
                </article>
              );
            })}
          </div>
        </fieldset>
      ))}

      {error === null ? null : <p role="alert">{error}</p>}
      <p aria-live="polite" aria-atomic="true">{status}</p>
    </section>
  );
}
