import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { isCameraObstacle, resolveCameraCollision } from './cameraCollision';

function obstacleBox(
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  markerOnAncestor = false,
): Group {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial());
  mesh.position.set(...position);
  if (markerOnAncestor) root.userData.cameraObstacle = true;
  else mesh.userData.cameraObstacle = true;
  root.add(mesh);
  return root;
}

function resolve(root: Group, target: Vector3, camera: Vector3): Vector3 {
  root.updateMatrixWorld(true);
  return resolveCameraCollision({
    desiredCamera: camera,
    obstacleRoot: root,
    output: new Vector3(),
    raycaster: new Raycaster(),
    target,
  });
}

describe('spectator camera collision', () => {
  it('recognizes obstacle markers inherited from ancestor groups', () => {
    const root = obstacleBox([0, 0, 4], [2, 2, 2], true);
    const mesh = root.children[0];
    expect(mesh).toBeDefined();
    expect(isCameraObstacle(mesh!)).toBe(true);
  });

  it('stops before a building between the target and desired camera', () => {
    const root = obstacleBox([0, 0, 5], [2, 4, 2]);
    const result = resolve(root, new Vector3(0, 0, 0), new Vector3(0, 0, 10));

    expect(result.z).toBeGreaterThan(3);
    expect(result.z).toBeLessThan(3.5);
  });

  it('recovers when the desired camera already begins inside a building', () => {
    const root = obstacleBox([0, 0, 5], [2, 4, 2]);
    const result = resolve(root, new Vector3(0, 0, 0), new Vector3(0, 0, 5));

    expect(result.z).toBeGreaterThan(3);
    expect(result.z).toBeLessThan(3.5);
  });

  it('moves beyond the exit when the followed target starts inside a building', () => {
    const root = obstacleBox([0, 0, 0], [6, 4, 6], true);
    const result = resolve(root, new Vector3(0, 0, 0), new Vector3(0, 0, 1));

    expect(result.z).toBeGreaterThan(3.5);
  });

  it('leaves an unobstructed desired camera unchanged', () => {
    const root = obstacleBox([5, 0, 5], [2, 4, 2]);
    const desired = new Vector3(0, 2, 8);
    const result = resolve(root, new Vector3(0, 0, 0), desired);

    expect(result.distanceTo(desired)).toBeLessThan(0.000001);
  });
});
