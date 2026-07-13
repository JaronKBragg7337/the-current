/** Convert a scalar stock into a small, legible presentation tier. */
export function resourceTier(value: number): number {
  if (value <= 4) return 0;
  if (value <= 18) return 1;
  if (value <= 55) return 2;
  return 3;
}
