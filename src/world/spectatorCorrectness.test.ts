import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { hasObservableRareEvidence, RARE_EVIDENCE_DISCLOSURE_THRESHOLD } from '../ui/rareEvidence';
import {
  buildingDoorway,
  BUILDING_WALL_BASE,
  BUILDING_WALL_THICKNESS,
  createBuildingWallShell,
} from './buildingShell';
import { dampCameraFov, SPECTATOR_FOV, targetCameraFov } from './cameraFov';

const HOUSE = { width: 7.2, depth: 8.2, wallHeight: 3.6 };

describe('spectator correctness', () => {
  it('restores first-person field of view smoothly toward the 48 degree spectator lens', () => {
    const firstStep = dampCameraFov(62, 'orbital', 100, 1 / 60);
    expect(targetCameraFov('orbital', 100)).toBe(SPECTATOR_FOV);
    expect(firstStep).toBeGreaterThan(SPECTATOR_FOV);
    expect(firstStep).toBeLessThan(62);

    let fov = 62;
    for (let frame = 0; frame < 180; frame += 1) fov = dampCameraFov(fov, 'follow', 100, 1 / 60);
    expect(fov).toBeCloseTo(SPECTATOR_FOV, 4);
  });

  it('only discloses rare-potential observations after meaningful 0-100 evidence', () => {
    expect(RARE_EVIDENCE_DISCLOSURE_THRESHOLD).toBe(34);
    expect(hasObservableRareEvidence(33.999)).toBe(false);
    expect(hasObservableRareEvidence(34)).toBe(true);
  });

  it('provides a human-scaled opening through the front wall while walls block sight', () => {
    const doorway = buildingDoorway(HOUSE);
    const shell = new Mesh(
      createBuildingWallShell(HOUSE),
      new MeshBasicMaterial({ side: DoubleSide }),
    );
    shell.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    const inside = new Vector3(0, BUILDING_WALL_BASE + 1.4, 0);

    raycaster.set(inside, new Vector3(0, 0, 1));
    const throughDoor = raycaster.intersectObject(shell, false);
    raycaster.set(inside.set(doorway.width, BUILDING_WALL_BASE + 1.4, 0), new Vector3(0, 0, 1));
    const throughWall = raycaster.intersectObject(shell, false);

    expect(doorway.width).toBeGreaterThanOrEqual(1.25);
    expect(doorway.height).toBeGreaterThanOrEqual(2.25);
    expect(throughDoor).toHaveLength(0);
    expect(throughWall[0]?.distance).toBeCloseTo(HOUSE.depth / 2 - BUILDING_WALL_THICKNESS, 4);
  });
});
