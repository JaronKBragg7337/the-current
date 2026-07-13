import { MathUtils } from 'three';

import type { CameraMode } from '../app/types';

export const SPECTATOR_FOV = 48;
export const FIRST_PERSON_FOV = 62;
export const INJURED_FIRST_PERSON_FOV = 68;

export function targetCameraFov(mode: CameraMode, health: number): number {
  if (mode !== 'first-person') return SPECTATOR_FOV;
  return health < 25 ? INJURED_FIRST_PERSON_FOV : FIRST_PERSON_FOV;
}

export function dampCameraFov(currentFov: number, mode: CameraMode, health: number, delta: number): number {
  return MathUtils.damp(currentFov, targetCameraFov(mode, health), 5, delta);
}
