// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ObserverInterventions } from './ObserverInterventions';

const BUDGET_STORAGE_KEY = 'the-current.observer-budget.v1';

interface StoredBudget {
  energy: number;
  accountedDay: number;
  cooldownUntil: Record<string, number>;
}

function storedBudget(): StoredBudget {
  const value = localStorage.getItem(BUDGET_STORAGE_KEY);
  if (value === null) throw new Error('Expected a stored observer budget');
  return JSON.parse(value) as StoredBudget;
}

function foodButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes('Spend 3 energy'),
  );
  if (button === undefined) throw new Error('Food shipment button was not found');
  return button;
}

describe('observer intervention budget durability', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it('durably debits energy and cooldown before the async submission resolves', async () => {
    let resolveSubmission: (() => void) | undefined;
    const onSubmitIntervention = vi.fn(() => new Promise<void>((resolve) => {
      resolveSubmission = resolve;
    }));
    await act(async () => root.render(
      <ObserverInterventions
        currentDay={8}
        targetSettlementId="settlement-1"
        onSubmitIntervention={onSubmitIntervention}
      />,
    ));

    await act(async () => {
      foodButton(container).click();
    });

    expect(onSubmitIntervention).toHaveBeenCalledTimes(1);
    expect(storedBudget()).toEqual({
      energy: 9,
      accountedDay: 8,
      cooldownUntil: { 'food-drop': 11 },
    });

    await act(async () => root.unmount());
    resolveSubmission?.();
    await Promise.resolve();
    expect(storedBudget().energy).toBe(9);

    root = createRoot(container);
  });

  it('rolls the durable debit and cooldown back when submission fails', async () => {
    let rejectSubmission: ((error: Error) => void) | undefined;
    const onSubmitIntervention = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectSubmission = reject;
    }));
    await act(async () => root.render(
      <ObserverInterventions
        currentDay={4}
        targetSettlementId="settlement-1"
        onSubmitIntervention={onSubmitIntervention}
      />,
    ));

    await act(async () => {
      foodButton(container).click();
    });
    expect(storedBudget().energy).toBe(9);

    await act(async () => {
      rejectSubmission?.(new Error('Persistence unavailable'));
      await Promise.resolve();
    });

    expect(storedBudget()).toEqual({
      energy: 12,
      accountedDay: 4,
      cooldownUntil: {},
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'No observer energy was spent',
    );
  });
});
