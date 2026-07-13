import { useMemo } from 'react';

import { BUILDING_FOOTPRINTS, MAIN_ROADS, type BuildingProjection, type ResourceLedger } from '../simulation';
import { ConfluenceAsset, type ConfluenceAssetName } from './ConfluenceKit';
import { terrainHeight } from './terrain';
import { resourceTier } from './visualProjection';

interface EconomyLayerProps {
  buildings: BuildingProjection[];
  resources: ResourceLedger;
}

interface YardSpec {
  asset: ConfluenceAssetName;
  resource: keyof ResourceLedger;
  anchor: readonly [number, number];
  color: string;
  rotation: number;
}

const YARDS: readonly YardSpec[] = [
  { asset: 'Asset_MarketStall', resource: 'food', anchor: [-14, -8], color: '#a77b51', rotation: 0.08 },
  { asset: 'Asset_WaterWorks', resource: 'water', anchor: [15, -11], color: '#71898a', rotation: -0.14 },
  { asset: 'Asset_TimberYard', resource: 'wood', anchor: [-25, 13], color: '#7d694c', rotation: 0.22 },
  { asset: 'Asset_StoneDepot', resource: 'stone', anchor: [27, 15], color: '#77766c', rotation: -0.18 },
  { asset: 'Asset_Generator', resource: 'energy', anchor: [8, 23], color: '#66726e', rotation: Math.PI },
] as const;

function clearOfRoads(x: number, z: number): boolean {
  return MAIN_ROADS.every((road) => road.points.every((point) => Math.hypot(x - point.x, z - point.z) > road.halfWidth + 3.2));
}

function clearOfBuildings(x: number, z: number, buildings: BuildingProjection[]): boolean {
  return buildings.every((building) => {
    if (building.type === 'road') return true;
    const footprint = BUILDING_FOOTPRINTS[building.type];
    return Math.abs(x - building.position.x) > footprint.width / 2 + 3.4
      || Math.abs(z - building.position.z) > footprint.depth / 2 + 3.4;
  });
}

function findYardPosition(anchor: readonly [number, number], buildings: BuildingProjection[]): readonly [number, number] {
  const offsets = [
    [0, 0], [7, 0], [-7, 0], [0, 7], [0, -7],
    [7, 7], [-7, 7], [7, -7], [-7, -7], [13, 0], [-13, 0],
  ] as const;
  for (const [dx, dz] of offsets) {
    const x = anchor[0] + dx;
    const z = anchor[1] + dz;
    if (clearOfRoads(x, z) && clearOfBuildings(x, z, buildings)) return [x, z];
  }
  return anchor;
}

export function EconomyLayer({ buildings, resources }: EconomyLayerProps) {
  const yards = useMemo(() => YARDS.map((yard) => ({
    ...yard,
    position: findYardPosition(yard.anchor, buildings),
    tier: resourceTier(resources[yard.resource]),
  })), [buildings, resources]);

  return (
    <group name="visible-economy">
      {([
        [-7.6, -7.4, Math.PI * 0.25],
        [7.5, -7.2, Math.PI * 0.75],
        [-7.4, 7.5, -Math.PI * 0.25],
        [7.4, 7.4, -Math.PI * 0.75],
      ] as const).map(([x, z, rotation]) => (
        <ConfluenceAsset
          key={`lamp:${x}:${z}`}
          name="Asset_StreetLamp"
          position={[x, terrainHeight(x, z), z]}
          rotation={[0, rotation, 0]}
          scale={0.86}
        />
      ))}
      <ConfluenceAsset name="Asset_Bench" position={[-4.7, terrainHeight(-4.7, 5.5), 5.5]} rotation={[0, Math.PI, 0]} scale={0.72} />
      <ConfluenceAsset name="Asset_Bench" position={[4.9, terrainHeight(4.9, -5.4), -5.4]} rotation={[0, 0, 0]} scale={0.72} />
      {yards.map((yard) => {
        const [x, z] = yard.position;
        const ground = terrainHeight(x, z);
        const scale = 0.82 + yard.tier * 0.08;
        return (
          <group key={yard.resource} position={[x, ground, z]} rotation={[0, yard.rotation, 0]}>
            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[3.1 + yard.tier * 0.35, 20]} />
              <meshStandardMaterial color={yard.color} roughness={1} />
            </mesh>
            <ConfluenceAsset name={yard.asset} scale={scale} />
            {yard.tier === 0 && (
              <mesh position={[0, 0.045, 2.6]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.42, 0.56, 18]} />
                <meshBasicMaterial color="#c65f4e" transparent opacity={0.8} />
              </mesh>
            )}
            {Array.from({ length: yard.tier }, (_, index) => (
              <mesh key={index} position={[-1.15 + index * 1.1, 0.28, 2.25]} castShadow>
                <boxGeometry args={[0.75, 0.52, 0.78]} />
                <meshStandardMaterial color={yard.resource === 'food' ? '#a9854e' : yard.color} roughness={0.94} />
              </mesh>
            ))}
          </group>
        );
      })}
      {yards.filter((yard) => yard.resource === 'food' && yard.tier >= 2).map((yard) => {
        const [x, z] = yard.position;
        return (
          <ConfluenceAsset
            key="food-farm-stand"
            name="Asset_FarmStand"
            position={[x + 5.4, terrainHeight(x + 5.4, z + 0.8), z + 0.8]}
            rotation={[0, -0.16, 0]}
            scale={0.85}
          />
        );
      })}
      {yards.filter((yard) => yard.resource === 'food' && yard.tier >= 3).map((yard) => {
        const [x, z] = yard.position;
        return (
          <ConfluenceAsset
            key="commerce-cart"
            name="Asset_CargoCart"
            position={[x - 5.2, terrainHeight(x - 5.2, z + 1.2), z + 1.2]}
            rotation={[0, Math.PI / 2, 0]}
            scale={0.72}
          />
        );
      })}
    </group>
  );
}
