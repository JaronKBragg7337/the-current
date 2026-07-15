import { useMemo } from 'react';

import { MAIN_ROADS, type BuildingProjection } from '../simulation';
import { createRoadRibbonGeometry, type RoadPoint } from './roadGeometry';
import { accessPathForBuilding } from './roadAccess';
import { terrainHeight } from './terrain';

interface RoadNetworkProps {
  buildings: BuildingProjection[];
}

export function RoadNetwork({ buildings }: RoadNetworkProps) {
  const geometries = useMemo(() => {
    // The main road corridors are authoritative simulation data: vehicles
    // drive exactly on them and building placement keeps clear of them.
    const roads: { points: RoadPoint[]; halfWidth: number; shoulder: number; main: boolean }[] = MAIN_ROADS.map((road) => ({
      points: road.points.map((point) => ({ x: point.x, z: point.z })),
      halfWidth: road.halfWidth,
      shoulder: 0.85,
      main: true,
    }));

    for (const building of buildings) {
      if (building.type === 'road') continue;
      const accessPath = accessPathForBuilding(building);
      if (accessPath !== null) {
        roads.push({
          points: accessPath,
          halfWidth: 0.5,
          shoulder: 0.16,
          main: false,
        });
      }
    }
    return roads.map((road) => ({
      main: road.main,
      shoulder: createRoadRibbonGeometry(road.points, road.halfWidth + road.shoulder, 0.075),
      surface: createRoadRibbonGeometry(road.points, road.halfWidth, 0.12),
      marking: road.main ? createRoadRibbonGeometry(road.points, 0.075, 0.145) : null,
    }));
  }, [buildings]);

  return (
    <group name="road-network">
      <mesh position={[0, terrainHeight(0, 0) + 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8.5, 40]} />
        <meshStandardMaterial color="#777065" roughness={1} />
      </mesh>
      <mesh position={[0, terrainHeight(0, 0) + 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[6.2, 7.2, 40]} />
        <meshStandardMaterial color="#9a8b70" roughness={1} />
      </mesh>
      {geometries.map((road, index) => (
        <group key={road.surface.uuid}>
          <mesh geometry={road.shoulder} receiveShadow userData={{ cameraObstacle: false }}>
            <meshStandardMaterial color={road.main ? '#8c806c' : '#c1b28e'} roughness={1} />
          </mesh>
          <mesh geometry={road.surface} receiveShadow userData={{ cameraObstacle: false }}>
            <meshStandardMaterial
              color={road.main ? '#4c514f' : '#ab9c7f'}
              roughness={0.98}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
          {road.marking !== null && (
            <mesh geometry={road.marking} userData={{ cameraObstacle: false }}>
              <meshStandardMaterial color={index % 2 === 0 ? '#d6c990' : '#cec59e'} roughness={0.9} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
