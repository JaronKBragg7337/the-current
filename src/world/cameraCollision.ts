import {
  Box3,
  Matrix4,
  Mesh,
  Ray,
  Vector3,
} from 'three';
import type { Object3D, Raycaster } from 'three';

const DEFAULT_CAMERA_RADIUS = 0.55;
const SURFACE_EPSILON = 0.08;
const MIN_RAY_DISTANCE = 0.001;

interface CameraObstacleMetadata {
  obstacle: boolean;
  volume: boolean;
}

export interface CameraCollisionOptions {
  cameraRadius?: number;
  desiredCamera: Vector3;
  obstacleRoot: Object3D;
  output: Vector3;
  raycaster: Raycaster;
  target: Vector3;
}

const obstacleMeshes: Mesh[] = [];
const localBox = new Box3();
const inverseWorld = new Matrix4();
const localRay = new Ray();
const worldRay = new Ray();
const localTarget = new Vector3();
const intersection = new Vector3();
const worldIntersection = new Vector3();
const direction = new Vector3();
const worldScale = new Vector3();

function obstacleMetadata(object: Object3D): CameraObstacleMetadata {
  let current: Object3D | null = object;
  let volume = true;

  while (current !== null) {
    if (current.userData.cameraObstacle === false) return { obstacle: false, volume: false };
    if (current.userData.cameraObstacleVolume === false) volume = false;
    if (current.userData.cameraObstacle === true) return { obstacle: true, volume };
    current = current.parent;
  }

  return { obstacle: false, volume: false };
}

/**
 * A collision marker may be placed on a mesh or any of its ancestor groups.
 * A descendant can opt out with `cameraObstacle: false`.
 */
export function isCameraObstacle(object: Object3D): boolean {
  return obstacleMetadata(object).obstacle;
}

function collectObstacleMeshes(root: Object3D): Mesh[] {
  obstacleMeshes.length = 0;
  root.traverse((object) => {
    if (object instanceof Mesh && object.visible && isCameraObstacle(object)) {
      obstacleMeshes.push(object as Mesh);
    }
  });
  return obstacleMeshes;
}

function volumeIntersectionDistance(
  mesh: Mesh,
  target: Vector3,
  ray: Ray,
  cameraRadius: number,
): { distance: number; targetInside: boolean } | null {
  const metadata = obstacleMetadata(mesh);
  if (!metadata.volume) return null;

  const geometry = mesh.geometry;
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  if (geometry.boundingBox === null) return null;

  mesh.updateWorldMatrix(true, false);
  inverseWorld.copy(mesh.matrixWorld).invert();
  localRay.copy(ray).applyMatrix4(inverseWorld);
  localTarget.copy(target).applyMatrix4(inverseWorld);

  mesh.getWorldScale(worldScale);
  const smallestScale = Math.max(
    MIN_RAY_DISTANCE,
    Math.min(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z)),
  );
  localBox.copy(geometry.boundingBox).expandByScalar(cameraRadius / smallestScale);
  const targetInside = localBox.containsPoint(localTarget);
  const hit = localRay.intersectBox(localBox, intersection);
  if (hit === null) return null;

  worldIntersection.copy(hit).applyMatrix4(mesh.matrixWorld);
  const distance = worldIntersection.sub(target).dot(ray.direction);
  if (distance <= MIN_RAY_DISTANCE) return null;
  return { distance, targetInside };
}

/**
 * Resolves a spectator camera along the target-to-camera segment.
 *
 * When the target is outside an obstacle, the camera stops just before the
 * first surface. When the target begins inside a marked building volume, the
 * camera is moved beyond the volume's exit instead of being trapped inside it.
 * This also recovers a desired camera position that already starts in a wall.
 */
export function resolveCameraCollision({
  cameraRadius = DEFAULT_CAMERA_RADIUS,
  desiredCamera,
  obstacleRoot,
  output,
  raycaster,
  target,
}: CameraCollisionOptions): Vector3 {
  output.copy(desiredCamera);
  direction.copy(desiredCamera).sub(target);
  const desiredDistance = direction.length();
  if (desiredDistance <= MIN_RAY_DISTANCE) return output;

  direction.multiplyScalar(1 / desiredDistance);
  worldRay.set(target, direction);
  const meshes = collectObstacleMeshes(obstacleRoot);

  let containingExit = 0;
  let nearestEntry = Number.POSITIVE_INFINITY;
  for (const mesh of meshes) {
    const hit = volumeIntersectionDistance(mesh, target, worldRay, cameraRadius);
    if (hit === null) continue;
    if (hit.targetInside) containingExit = Math.max(containingExit, hit.distance);
    else nearestEntry = Math.min(nearestEntry, hit.distance);
  }

  let resolvedDistance = desiredDistance;
  if (containingExit > 0) {
    resolvedDistance = Math.max(desiredDistance, containingExit + SURFACE_EPSILON);
  } else if (nearestEntry < desiredDistance) {
    resolvedDistance = Math.max(MIN_RAY_DISTANCE, nearestEntry - SURFACE_EPSILON);
  }

  // Ray-only obstacles (notably the irregular terrain mesh) do not have a
  // meaningful solid bounding volume. Keep their precise surface raycasts.
  raycaster.set(target, direction);
  raycaster.far = resolvedDistance;
  const surfaceHit = raycaster.intersectObjects(meshes, false).find((hit) => {
    if (hit.distance <= MIN_RAY_DISTANCE) return false;
    if (containingExit > 0 && hit.distance <= containingExit + SURFACE_EPSILON) return false;
    return true;
  });
  if (surfaceHit !== undefined && surfaceHit.distance < resolvedDistance) {
    resolvedDistance = Math.max(MIN_RAY_DISTANCE, surfaceHit.distance - cameraRadius);
  }

  // A second building beyond the volume containing the target still blocks
  // the follow camera once it has safely exited the first building.
  if (
    containingExit > 0
    && nearestEntry > containingExit + SURFACE_EPSILON
    && nearestEntry < resolvedDistance
  ) {
    resolvedDistance = Math.max(containingExit + SURFACE_EPSILON, nearestEntry - SURFACE_EPSILON);
  }

  return output.copy(target).addScaledVector(direction, resolvedDistance);
}
