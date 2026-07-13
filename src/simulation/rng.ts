const UINT32_RANGE = 0x1_0000_0000;

export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const value = hash >>> 0;
  return value === 0 ? 0x9e3779b9 : value;
}

export class DeterministicRng {
  private stateValue: number;

  constructor(state: number) {
    const normalized = state >>> 0;
    this.stateValue = normalized === 0 ? 0x9e3779b9 : normalized;
  }

  static fromSeed(seed: string): DeterministicRng {
    return new DeterministicRng(hashSeed(seed));
  }

  static restore(state: number): DeterministicRng {
    return new DeterministicRng(state);
  }

  snapshot(): number {
    return this.stateValue >>> 0;
  }

  nextUint32(): number {
    let value = this.stateValue;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.stateValue = value >>> 0;
    return this.stateValue;
  }

  float(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  int(minimum: number, maximum: number): number {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
      throw new RangeError(`Invalid integer range ${minimum}..${maximum}`);
    }
    const range = maximum - minimum + 1;
    if (range <= 0 || range > UINT32_RANGE) {
      throw new RangeError(`Integer range is too large: ${minimum}..${maximum}`);
    }
    const limit = UINT32_RANGE - (UINT32_RANGE % range);
    let value = this.nextUint32();
    while (value >= limit) value = this.nextUint32();
    return minimum + (value % range);
  }

  bool(probability = 0.5): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.float() < probability;
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new RangeError('Cannot pick from an empty collection');
    const value = values[this.int(0, values.length - 1)];
    if (value === undefined) throw new RangeError('RNG selected an invalid collection index');
    return value;
  }

  weightedPick<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (items.length === 0 || total <= 0) throw new RangeError('Weighted selection needs a positive weight');
    let cursor = this.float() * total;
    for (const item of items) {
      cursor -= Math.max(0, item.weight);
      if (cursor < 0) return item.value;
    }
    const fallback = items[items.length - 1];
    if (fallback === undefined) throw new RangeError('Weighted selection failed');
    return fallback.value;
  }

  fork(label: string): DeterministicRng {
    return DeterministicRng.fromSeed(`${this.stateValue.toString(16)}:${label}`);
  }
}

export function deterministicStream(seed: string, ...parts: readonly (number | string)[]): DeterministicRng {
  return DeterministicRng.fromSeed([seed, ...parts.map(String)].join('|'));
}
