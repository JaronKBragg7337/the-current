import type { Position3 } from '../simulation';

const WORLD_RADIUS = 154;

export function terrainHeight(x: number, z: number): number {
  const radial = Math.hypot(x / 1.12, z);
  const coast = radial > WORLD_RADIUS - 22
    ? -Math.pow((radial - (WORLD_RADIUS - 22)) / 15, 2) * 10
    : 0;
  const broad = Math.sin(x * 0.028) * 2.2 + Math.cos(z * 0.033) * 1.8;
  const detail = Math.sin((x + z) * 0.083) * 0.55 + Math.cos((x - z) * 0.071) * 0.45;
  const settlementFlatten = Math.min(1, Math.max(0, (Math.hypot(x, z) - 55) / 48));
  return (broad + detail) * settlementFlatten + coast;
}
export function toWorldPosition(position: Position3, lift = 0): [number, number, number] {
  return [position.x, terrainHeight(position.x, position.z) + position.y + lift, position.z];
}

export function worldRadius(): number {
  return WORLD_RADIUS;
}

export function deterministicUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
}
