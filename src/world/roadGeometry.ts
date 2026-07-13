import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

import { terrainHeight } from './terrain';

export interface RoadPoint {
  x: number;
  z: number;
}

export function createRoadRibbonGeometry(points: RoadPoint[], halfWidth: number, heightOffset = 0.11): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  let distance = 0;

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)] ?? point;
    const next = points[Math.min(points.length - 1, index + 1)] ?? point;
    const direction = new Vector3(next.x - previous.x, 0, next.z - previous.z).normalize();
    const normalX = -direction.z;
    const normalZ = direction.x;
    if (index > 0) {
      const prior = points[index - 1];
      if (prior !== undefined) distance += Math.hypot(point.x - prior.x, point.z - prior.z);
    }
    const leftX = point.x + normalX * halfWidth;
    const leftZ = point.z + normalZ * halfWidth;
    const rightX = point.x - normalX * halfWidth;
    const rightZ = point.z - normalZ * halfWidth;
    vertices.push(leftX, terrainHeight(leftX, leftZ) + heightOffset, leftZ);
    vertices.push(rightX, terrainHeight(rightX, rightZ) + heightOffset, rightZ);
    uvs.push(0, distance / 4, 1, distance / 4);
    if (index < points.length - 1) {
      const start = index * 2;
      // Wind the ribbon toward +Y. A downward winding is back-face culled by
      // every spectator camera above the world and makes roads disappear.
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
