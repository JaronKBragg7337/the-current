import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

import type { BuildingProjection } from '../simulation';
import { terrainHeight } from './terrain';

interface RoadNetworkProps {
  buildings: BuildingProjection[];
}

interface RoadPoint {
  x: number;
  z: number;
}

function ribbonGeometry(points: RoadPoint[], halfWidth: number): BufferGeometry {
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
    vertices.push(leftX, terrainHeight(leftX, leftZ) + 0.11, leftZ);
    vertices.push(rightX, terrainHeight(rightX, rightZ) + 0.11, rightZ);
    uvs.push(0, distance / 4, 1, distance / 4);
    if (index < points.length - 1) {
      const start = index * 2;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function RoadNetwork({ buildings }: RoadNetworkProps) {
  const geometries = useMemo(() => {
    const roads: RoadPoint[][] = [
      [
        { x: -128, z: 18 },
        { x: -105, z: 18 },
        { x: -74, z: 12 },
        { x: -42, z: 3 },
        { x: -8, z: 0 },
        { x: 32, z: 4 },
        { x: 68, z: 15 },
      ],
      [
        { x: -8, z: -55 },
        { x: -5, z: -30 },
        { x: -8, z: 0 },
        { x: -2, z: 28 },
        { x: 18, z: 58 },
      ],
      [
        { x: -44, z: -18 },
        { x: -18, z: -12 },
        { x: 12, z: -13 },
        { x: 42, z: -22 },
      ],
    ];

    for (const building of buildings) {
      if (building.type === 'road') continue;
      const distanceToMain = Math.abs(building.position.z);
      if (distanceToMain > 6) {
        roads.push([
          { x: building.position.x, z: 0 },
          { x: building.position.x, z: building.position.z },
        ]);
      }
    }
    return roads.map((road, index) => ribbonGeometry(road, index === 0 ? 2.45 : 1.65));
  }, [buildings]);

  return (
    <group name="road-network">
      {geometries.map((geometry, index) => (
        <mesh key={geometry.uuid} geometry={geometry} receiveShadow userData={{ cameraObstacle: false }}>
          <meshStandardMaterial
            color={index === 0 ? '#4f5351' : '#5c5a50'}
            roughness={0.98}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </group>
  );
}
