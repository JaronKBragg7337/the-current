import { BoxGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BuildingShellDimensions {
  width: number;
  depth: number;
  wallHeight: number;
}

export interface BuildingDoorway {
  bottom: number;
  height: number;
  width: number;
}

export const BUILDING_WALL_BASE = 0.53;
export const BUILDING_WALL_THICKNESS = 0.24;

/**
 * Keeps every entrance human-scaled while allowing the larger civic buildings
 * to receive a slightly wider opening.
 */
export function buildingDoorway({ width, wallHeight }: BuildingShellDimensions): BuildingDoorway {
  return {
    bottom: BUILDING_WALL_BASE,
    height: Math.min(2.4, wallHeight - 0.32),
    width: Math.min(1.5, Math.max(1.25, width * 0.18)),
  };
}

function wallBox(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

/**
 * Creates a single merged shell rather than a sealed box. The front wall is
 * split around a real doorway; the remaining pieces form the rear and sides.
 * The caller can therefore render and raycast the interior without adding a
 * draw call for every wall segment.
 */
export function createBuildingWallShell(dimensions: BuildingShellDimensions): BufferGeometry {
  const { depth, wallHeight, width } = dimensions;
  const doorway = buildingDoorway(dimensions);
  const thickness = BUILDING_WALL_THICKNESS;
  const wallCenterY = BUILDING_WALL_BASE + wallHeight / 2;
  const sideDepth = depth - thickness * 2;
  const frontSideWidth = (width - doorway.width) / 2;
  const frontSideOffset = doorway.width / 2 + frontSideWidth / 2;
  const lintelHeight = wallHeight - doorway.height;
  const frontZ = depth / 2 - thickness / 2;
  const backZ = -depth / 2 + thickness / 2;

  const parts = [
    wallBox(frontSideWidth, wallHeight, thickness, -frontSideOffset, wallCenterY, frontZ),
    wallBox(frontSideWidth, wallHeight, thickness, frontSideOffset, wallCenterY, frontZ),
    wallBox(
      doorway.width,
      lintelHeight,
      thickness,
      0,
      doorway.bottom + doorway.height + lintelHeight / 2,
      frontZ,
    ),
    wallBox(width, wallHeight, thickness, 0, wallCenterY, backZ),
    wallBox(thickness, wallHeight, sideDepth, -width / 2 + thickness / 2, wallCenterY, 0),
    wallBox(thickness, wallHeight, sideDepth, width / 2 - thickness / 2, wallCenterY, 0),
  ];

  const shell = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (shell === null) throw new Error('Unable to merge building wall shell geometry');
  shell.computeBoundingBox();
  shell.computeBoundingSphere();
  return shell;
}
