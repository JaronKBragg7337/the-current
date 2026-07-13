import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color, DoubleSide } from 'three';

import type { BuildingProjection, BuildingType, ConstructionStage } from '../simulation';
import { createBuildingWallShell } from './buildingShell';
import { deterministicUnit, terrainHeight } from './terrain';

interface BuildingFigureProps {
  building: BuildingProjection;
  selected: boolean;
  onSelect: (buildingId: string) => void;
}

interface BuildingStyle {
  width: number;
  depth: number;
  wallHeight: number;
  wall: string;
  roof: string;
}

const STAGE_RANK: Record<ConstructionStage, number> = {
  planned: 0,
  'site-selection': 1,
  foundation: 2,
  frame: 3,
  walls: 4,
  roof: 5,
  interior: 6,
  utilities: 7,
  complete: 8,
};

const STYLES: Record<BuildingType, BuildingStyle> = {
  clinic: { width: 11, depth: 8, wallHeight: 4.2, wall: '#d8ddd3', roof: '#55736f' },
  'council-hall': { width: 14, depth: 10, wallHeight: 5.1, wall: '#c9b889', roof: '#405760' },
  farm: { width: 15, depth: 11, wallHeight: 1, wall: '#8f6f3f', roof: '#89724b' },
  house: { width: 7.2, depth: 8.2, wallHeight: 3.6, wall: '#d5c39d', roof: '#7b4e3c' },
  market: { width: 12, depth: 9, wallHeight: 3.7, wall: '#c28b5a', roof: '#8b5d4d' },
  'power-station': { width: 13, depth: 9, wallHeight: 5, wall: '#788984', roof: '#3b4d50' },
  road: { width: 8, depth: 4, wallHeight: 0.2, wall: '#5e5e58', roof: '#5e5e58' },
  school: { width: 13, depth: 9, wallHeight: 4.5, wall: '#c7a86d', roof: '#536d67' },
  warehouse: { width: 14, depth: 10, wallHeight: 5.5, wall: '#9a8d72', roof: '#535b59' },
  well: { width: 4, depth: 4, wallHeight: 2.8, wall: '#8e8878', roof: '#6b4d39' },
  workshop: { width: 11, depth: 8, wallHeight: 4.3, wall: '#a88d6d', roof: '#4f5b59' },
};

function renderStakes(width: number, depth: number) {
  const corners = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ] as const;
  return corners.map(([x, z]) => (
    <mesh key={`${x}:${z}`} position={[x, 0.48, z]} castShadow>
      <cylinderGeometry args={[0.055, 0.075, 0.95, 6]} />
      <meshStandardMaterial color="#d7b26b" roughness={1} />
    </mesh>
  ));
}

function renderFrame(width: number, depth: number, height: number) {
  const posts = [
    [-width / 2 + 0.25, -depth / 2 + 0.25],
    [width / 2 - 0.25, -depth / 2 + 0.25],
    [-width / 2 + 0.25, depth / 2 - 0.25],
    [width / 2 - 0.25, depth / 2 - 0.25],
  ] as const;
  return (
    <group>
      {posts.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, height / 2 + 0.3, z]} castShadow>
          <cylinderGeometry args={[0.15, 0.18, height, 8]} />
          <meshStandardMaterial color="#8c6941" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.17, -depth / 2 + 0.25]} castShadow>
        <boxGeometry args={[width, 0.28, 0.3]} />
        <meshStandardMaterial color="#8c6941" roughness={0.9} />
      </mesh>
      <mesh position={[0, height + 0.17, depth / 2 - 0.25]} castShadow>
        <boxGeometry args={[width, 0.28, 0.3]} />
        <meshStandardMaterial color="#8c6941" roughness={0.9} />
      </mesh>
    </group>
  );
}

function renderFarm(stage: number, progress: number) {
  const rows = Array.from({ length: 8 }, (_, index) => index);
  return (
    <group>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[15, 0.14, 11]} />
        <meshStandardMaterial color="#6c4f34" roughness={1} />
      </mesh>
      {stage >= 3 && rows.map((row) => {
        const maturity = Math.max(0.15, Math.min(1, progress + row * 0.025));
        return (
          <mesh key={row} position={[-6.3 + row * 1.8, 0.2 + maturity * 0.24, 0]} castShadow>
            <boxGeometry args={[0.48, 0.28 + maturity * 0.45, 9.4]} />
            <meshStandardMaterial color={new Color('#78914e').lerp(new Color('#d4b14d'), maturity * 0.45)} roughness={1} />
          </mesh>
        );
      })}
      {stage >= 5 && (
        <group position={[5.7, 1.1, -3.8]}>
          <mesh castShadow>
            <cylinderGeometry args={[1.05, 1.22, 2.1, 10]} />
            <meshStandardMaterial color="#aa8760" roughness={0.94} />
          </mesh>
          <mesh position={[0, 1.25, 0]} castShadow>
            <coneGeometry args={[1.45, 0.8, 10]} />
            <meshStandardMaterial color="#6b5139" roughness={0.95} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function renderWell(stage: number) {
  return (
    <group>
      {stage >= 2 && (
        <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.65, 1.85, 1.15, 16, 1, true]} />
          <meshStandardMaterial color="#8d897b" roughness={0.92} side={2} />
        </mesh>
      )}
      {stage >= 3 && [-1.35, 1.35].map((x) => (
        <mesh key={x} position={[x, 2.15, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.15, 3.3, 7]} />
          <meshStandardMaterial color="#735338" />
        </mesh>
      ))}
      {stage >= 5 && (
        <mesh position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[2.4, 1.25, 4]} />
          <meshStandardMaterial color="#74503a" roughness={0.92} />
        </mesh>
      )}
      {stage >= 6 && (
        <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.25, 24]} />
          <meshPhysicalMaterial color="#4f8990" roughness={0.2} metalness={0.06} />
        </mesh>
      )}
    </group>
  );
}

export function BuildingFigure({ building, selected, onSelect }: BuildingFigureProps) {
  const style = STYLES[building.type];
  const stage = STAGE_RANK[building.stage];
  const ground = terrainHeight(building.position.x, building.position.z);
  const rotation = useMemo(
    () => (deterministicUnit(building.id) - 0.5) * 0.34,
    [building.id],
  );
  const wallShell = useMemo(
    () => createBuildingWallShell(style),
    [style],
  );

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(building.id);
  };

  if (building.type === 'road') return null;

  return (
    <group
      name={`building:${building.id}`}
      position={[building.position.x, ground, building.position.z]}
      rotation={[0, rotation, 0]}
      onClick={handleSelect}
      userData={{ entityId: building.id, entityKind: 'building' }}
    >
      {selected && (
        <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(style.width, style.depth) * 0.6, Math.max(style.width, style.depth) * 0.69, 48]} />
          <meshBasicMaterial color="#f5d97a" transparent opacity={0.88} depthWrite={false} />
        </mesh>
      )}

      {stage <= 1 && renderStakes(style.width, style.depth)}
      {building.type === 'farm' && renderFarm(stage, building.progress)}
      {building.type === 'well' && renderWell(stage)}

      {building.type !== 'farm' && building.type !== 'well' && (
        <group>
          {stage >= 1 && (
            <mesh position={[0, 0.06, 0]} receiveShadow>
              <boxGeometry args={[style.width + 1.2, 0.12, style.depth + 1.2]} />
              <meshStandardMaterial color="#776c58" roughness={1} />
            </mesh>
          )}
          {stage >= 2 && (
            <mesh position={[0, 0.28, 0]} receiveShadow castShadow>
              <boxGeometry args={[style.width, 0.5, style.depth]} />
              <meshStandardMaterial color="#8c897c" roughness={0.96} />
            </mesh>
          )}
          {stage >= 3 && renderFrame(style.width, style.depth, style.wallHeight)}
          {stage >= 4 && (
            <mesh
              geometry={wallShell}
              castShadow
              receiveShadow
              userData={{ cameraObstacle: true, cameraObstacleVolume: false }}
            >
              <meshStandardMaterial color={style.wall} roughness={0.88} side={DoubleSide} />
            </mesh>
          )}
          {stage >= 4 && (
            <group position={[0, 1.8, style.depth / 2 + 0.025]}>
              {[-style.width * 0.29, style.width * 0.29].map((x) => (
                <mesh key={x} position={[x, 0.25, 0.08]}>
                  <boxGeometry args={[1.45, 1.15, 0.12]} />
                  <meshPhysicalMaterial color="#88b7bd" roughness={0.16} metalness={0.02} transparent opacity={0.72} />
                </mesh>
              ))}
            </group>
          )}
          {stage >= 5 && (
            <group position={[0, style.wallHeight + 0.57, 0]} userData={{ cameraObstacle: true }}>
              <mesh position={[-style.width * 0.245, 0.65, 0]} rotation={[0, 0, 0.55]} castShadow>
                <boxGeometry args={[style.width * 0.62, 0.34, style.depth + 0.7]} />
                <meshStandardMaterial color={style.roof} roughness={0.94} />
              </mesh>
              <mesh position={[style.width * 0.245, 0.65, 0]} rotation={[0, 0, -0.55]} castShadow>
                <boxGeometry args={[style.width * 0.62, 0.34, style.depth + 0.7]} />
                <meshStandardMaterial color={style.roof} roughness={0.94} />
              </mesh>
            </group>
          )}
          {stage >= 6 && (
            <group position={[0, 0.62, 0]}>
              <mesh position={[0, 0.04, 0]} receiveShadow>
                <boxGeometry args={[style.width - 0.45, 0.08, style.depth - 0.45]} />
                <meshStandardMaterial color="#8f7556" roughness={0.9} />
              </mesh>
              <mesh position={[-1.8, 0.6, -style.depth * 0.18]} castShadow>
                <boxGeometry args={[2.6, 0.82, 1.1]} />
                <meshStandardMaterial color="#624a38" roughness={0.92} />
              </mesh>
              <mesh position={[style.width * 0.3, 0.9, -style.depth / 2 + 0.42]} castShadow>
                <boxGeometry args={[1.35, 1.7, 0.42]} />
                <meshStandardMaterial color="#72583e" roughness={0.95} />
              </mesh>
            </group>
          )}
          {stage >= 7 && building.type === 'power-station' && (
            <group position={[style.width * 0.25, style.wallHeight + 2.5, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.45, 0.62, 5.2, 12]} />
                <meshStandardMaterial color="#485554" metalness={0.35} roughness={0.62} />
              </mesh>
              <mesh position={[0, 2.75, 0]}>
                <cylinderGeometry args={[0.63, 0.45, 0.6, 12]} />
                <meshStandardMaterial color="#394646" metalness={0.4} roughness={0.58} />
              </mesh>
            </group>
          )}
          {stage >= 8 && building.type === 'market' && (
            <group position={[0, 2.05, style.depth / 2 + 1.25]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, style.width * 0.72, 8]} />
                <meshStandardMaterial color="#765640" />
              </mesh>
              <mesh position={[0, 0.35, 0]} rotation={[0.12, 0, 0]} castShadow>
                <boxGeometry args={[style.width * 0.78, 0.12, 2.25]} />
                <meshStandardMaterial color="#c7805f" roughness={0.9} />
              </mesh>
            </group>
          )}
        </group>
      )}
    </group>
  );
}
