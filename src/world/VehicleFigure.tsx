import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { MathUtils } from 'three';

import type { VehicleProjection } from '../app/types';
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
  const wheelRefs = useRef<Array<Group | null>>([]);
  const offset = useMemo(() => vehicle.routeProgress, [vehicle.routeProgress]);

  useFrame(({ clock }, delta) => {
    const root = rootRef.current;
    if (root === null) return;
    const speed = vehicle.active ? 0.018 : 0;
    const progress = (offset + clock.elapsedTime * speed) % 1;
    const placed = positionOnRoute(route, progress);
    root.position.x = MathUtils.damp(root.position.x, placed.position.x, 8, delta);
    root.position.y = MathUtils.damp(root.position.y, placed.position.y + 0.5, 8, delta);
    root.position.z = MathUtils.damp(root.position.z, placed.position.z, 8, delta);
    root.rotation.y = MathUtils.damp(root.rotation.y, placed.yaw, 9, delta);
    for (const wheel of wheelRefs.current) {
      if (wheel !== null) wheel.rotation.x -= delta * (vehicle.active ? 4.8 : 0);
    }
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(vehicle.id);
  };

  return (
    <group
      ref={rootRef}
      name={`vehicle:${vehicle.id}`}
      position={[vehicle.position.x, vehicle.position.y + 0.5, vehicle.position.z]}
      rotation={[0, vehicle.yaw, 0]}
      onClick={handleSelect}
      userData={{ entityId: vehicle.id, entityKind: 'vehicle' }}
    >
      {selected && (
        <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.65, 1.83, 36]} />
          <meshBasicMaterial color="#f5d97a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[2.35, 0.62, 3.75]} />
        <meshStandardMaterial color="#576967" roughness={0.78} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.13, 0.82]} castShadow>
        <boxGeometry args={[2.12, 1.2, 1.55]} />
        <meshStandardMaterial color="#6e827c" roughness={0.76} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.27, 1.61]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[1.62, 0.62, 0.08]} />
        <meshPhysicalMaterial color="#7fb0b6" roughness={0.12} metalness={0.05} transparent opacity={0.72} />
      </mesh>
      <group position={[0, 0.98, -0.82]}>
        {[-0.68, 0, 0.68].map((x, index) => (
          <mesh key={x} position={[x, index === 1 ? 0.28 : 0, 0]} castShadow>
            <boxGeometry args={[0.58, 0.62, 1.15]} />
            <meshStandardMaterial color={index === 1 ? '#8d6b43' : '#a17c4f'} roughness={0.94} />
          </mesh>
        ))}
      </group>
      {([
        [-1.17, -1.16],
        [1.17, -1.16],
        [-1.17, 1.17],
        [1.17, 1.17],
      ] as const).map(([x, z], index) => (
        <group
          key={`${x}:${z}`}
          ref={(node) => { wheelRefs.current[index] = node; }}
          position={[x, 0.04, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.49, 0.49, 0.24, 14]} />
            <meshStandardMaterial color="#242726" roughness={0.96} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.27, 12]} />
            <meshStandardMaterial color="#87908d" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.1, 1.95]}>
        <boxGeometry args={[1.5, 0.18, 0.14]} />
        <meshStandardMaterial color="#e1c685" emissive="#8a6427" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}
