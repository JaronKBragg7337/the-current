import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { MathUtils } from 'three';

import type { VehicleProjection } from '../app/types';
import { ConfluenceAsset } from './ConfluenceKit';
import type { VehicleRoute } from './vehicles';
import { positionOnRoute } from './vehicles';

interface VehicleFigureProps {
  vehicle: VehicleProjection;
  route: VehicleRoute;
  selected: boolean;
  onSelect: (vehicleId: string) => void;
}

export function VehicleFigure({ vehicle, route, selected, onSelect }: VehicleFigureProps) {
  const rootRef = useRef<Group>(null);
  const offset = useMemo(() => vehicle.routeProgress, [vehicle.routeProgress]);

  useFrame(({ clock }, delta) => {
    const root = rootRef.current;
    if (root === null) return;
    const speed = vehicle.active ? 0.018 : 0;
    const progress = (offset + clock.elapsedTime * speed) % 1;
    const placed = positionOnRoute(route, progress);
    root.position.x = MathUtils.damp(root.position.x, placed.position.x, 8, delta);
    root.position.y = MathUtils.damp(root.position.y, placed.position.y + 0.13, 8, delta);
    root.position.z = MathUtils.damp(root.position.z, placed.position.z, 8, delta);
    root.rotation.y = MathUtils.damp(root.rotation.y, placed.yaw + Math.PI, 9, delta);
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(vehicle.id);
  };

  return (
    <group
      ref={rootRef}
      name={`vehicle:${vehicle.id}`}
      position={[vehicle.position.x, vehicle.position.y + 0.13, vehicle.position.z]}
      rotation={[0, vehicle.yaw + Math.PI, 0]}
      onClick={handleSelect}
      userData={{ entityId: vehicle.id, entityKind: 'vehicle' }}
    >
      {selected && (
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.45, 1.62, 36]} />
          <meshBasicMaterial color="#f5d97a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      <ConfluenceAsset name="Asset_CargoCart" scale={0.86} />
      <mesh position={[-0.68, 1.55, 0.12]} castShadow>
        <boxGeometry args={[0.46, 0.36, 0.5]} />
        <meshStandardMaterial color={vehicle.active ? '#bca167' : '#746b5b'} roughness={0.94} />
      </mesh>
      <mesh position={[0.62, 1.48, -0.2]} castShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.5, 10]} />
        <meshStandardMaterial color="#7e8b82" metalness={0.12} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.58, -2.15]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#f3d894" emissive="#b57b2f" emissiveIntensity={vehicle.active ? 0.9 : 0.15} />
      </mesh>
    </group>
  );
}
