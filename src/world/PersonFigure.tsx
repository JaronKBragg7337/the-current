import type { ThreeEvent } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { MathUtils, Vector3 } from 'three';

import type { CameraMode } from '../app/types';
import type { Occupation, PersonProjection } from '../simulation';
import { shouldRenderDetailedPerson } from './populationTiers';
import { deterministicUnit, terrainHeight } from './terrain';

interface PersonFigureProps {
  person: PersonProjection;
  selected: boolean;
  cameraMode: CameraMode;
  onSelect: (personId: string) => void;
  onFollow: (personId: string) => void;
}

const OCCUPATION_COLORS: Record<Occupation, string> = {
  artist: '#a05c83',
  builder: '#b77b48',
  caregiver: '#8a719d',
  explorer: '#6f7955',
  farmer: '#6f824f',
  healer: '#5f8990',
  hunter: '#6c6848',
  inventor: '#6d7398',
  laborer: '#8a704f',
  mechanic: '#59676b',
  organizer: '#8d6158',
  researcher: '#646f98',
  teacher: '#8a6d94',
  trader: '#9b744f',
  unemployed: '#716d68',
};

const SKIN_TONES = ['#f0c7a5', '#dba77e', '#bb7e58', '#8e593f', '#643d31'] as const;
const HAIR_TONES = ['#2e211e', '#5b3928', '#8c6542', '#bc925f', '#4c4542'] as const;

function paletteValue(values: readonly string[], seed: number): string {
  return values[Math.min(values.length - 1, Math.floor(seed * values.length))] ?? values[0] ?? '#777777';
}

export function PersonFigure({ person, selected, cameraMode, onSelect, onFollow }: PersonFigureProps) {
  const rootRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const torsoRef = useRef<Mesh>(null);
  const { camera } = useThree();
  const target = useMemo(() => new Vector3(), []);
  const groundHeight = useMemo(
    () => terrainHeight(person.position.x, person.position.z),
    [person.position.x, person.position.z],
  );
  const bodySeed = deterministicUnit(`${person.id}:body`);
  const skin = paletteValue(SKIN_TONES, bodySeed);
  const hair = person.lifeStage === 'elder'
    ? '#b9b5aa'
    : paletteValue(HAIR_TONES, deterministicUnit(`${person.id}:hair`));
  const clothing = OCCUPATION_COLORS[person.occupation];
  const heightScale = person.heightMeters / 1.72;
  const childScale = person.lifeStage === 'child' ? 0.92 : person.lifeStage === 'adolescent' ? 0.96 : 1;
  const bodyWidth = 0.92 + (bodySeed - 0.5) * 0.18;

  useFrame(({ clock }, delta) => {
    const root = rootRef.current;
    if (root === null) return;
    target.set(
      person.position.x,
      groundHeight,
      person.position.z,
    );
    const selectedFirstPerson = selected && cameraMode === 'first-person';
    root.visible = shouldRenderDetailedPerson(
      camera.position.distanceToSquared(target),
      selected,
      selectedFirstPerson,
    );
    if (!root.visible) return;

    root.position.x = MathUtils.damp(root.position.x, target.x, 4.5, delta);
    root.position.y = MathUtils.damp(root.position.y, target.y, 6, delta);
    root.position.z = MathUtils.damp(root.position.z, target.z, 4.5, delta);
    root.rotation.y = MathUtils.damp(root.rotation.y, person.yaw, 5, delta);

    const active = !['idle', 'rest', 'eat'].includes(person.task);
    const speed = person.task === 'travel' ? 6.4 : person.task === 'build' || person.task === 'work' ? 5.1 : 3.4;
    const phase = clock.elapsedTime * speed + deterministicUnit(person.id) * Math.PI * 2;
    const stride = active ? Math.sin(phase) * (person.health / 100) * 0.58 : Math.sin(phase * 0.35) * 0.035;
    if (leftArmRef.current !== null) leftArmRef.current.rotation.x = stride;
    if (rightArmRef.current !== null) {
      const workLift = person.task === 'build' ? -0.65 + Math.sin(phase) * 0.82 : -stride;
      rightArmRef.current.rotation.x = workLift;
      rightArmRef.current.rotation.z = person.task === 'socialize' ? -0.55 : -0.08;
    }
    if (leftLegRef.current !== null) leftLegRef.current.rotation.x = -stride * 0.78;
    if (rightLegRef.current !== null) rightLegRef.current.rotation.x = stride * 0.78;
    if (torsoRef.current !== null) {
      torsoRef.current.rotation.z = person.health < 40 ? 0.08 : 0;
      torsoRef.current.position.y = 1.58 + (active ? Math.abs(Math.sin(phase)) * 0.025 : 0);
    }
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(person.id);
  };

  const handleFollow = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onFollow(person.id);
  };

  return (
    <group
      ref={rootRef}
      name={`person:${person.id}`}
      position={[person.position.x, groundHeight, person.position.z]}
      rotation={[0, person.yaw, 0]}
      scale={[heightScale * bodyWidth, heightScale * childScale, heightScale * bodyWidth]}
      onClick={handleSelect}
      onDoubleClick={handleFollow}
      userData={{ entityId: person.id, entityKind: 'person' }}
    >
      {selected && (
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.58, 0.7, 32]} />
          <meshBasicMaterial color="#f6dd85" transparent opacity={0.95} depthWrite={false} />
        </mesh>
      )}

      <mesh ref={torsoRef} position={[0, 1.58, 0]} castShadow>
        <capsuleGeometry args={[0.31, 0.56, 6, 10]} />
        <meshStandardMaterial color={clothing} roughness={0.86} />
      </mesh>
      <mesh position={[0, 2.27, 0]} castShadow>
        <sphereGeometry args={[0.29, 14, 11]} />
        <meshStandardMaterial color={skin} roughness={0.84} />
      </mesh>
      <mesh position={[0, 2.42, -0.025]} scale={[1.03, 0.58, 1.01]} castShadow>
        <sphereGeometry args={[0.292, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={hair} roughness={0.96} />
      </mesh>
      <mesh position={[0, 2.27, 0.278]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.052, 0.105, 8]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>

      <group ref={leftArmRef} position={[-0.4, 1.89, 0]} rotation={[0, 0, 0.08]}>
        <mesh position={[0, -0.42, 0]} castShadow>
          <capsuleGeometry args={[0.105, 0.54, 4, 8]} />
          <meshStandardMaterial color={clothing} roughness={0.88} />
        </mesh>
        <mesh position={[0, -0.78, 0]} castShadow>
          <sphereGeometry args={[0.115, 9, 7]} />
          <meshStandardMaterial color={skin} roughness={0.85} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.4, 1.89, 0]} rotation={[0, 0, -0.08]}>
        <mesh position={[0, -0.42, 0]} castShadow>
          <capsuleGeometry args={[0.105, 0.54, 4, 8]} />
          <meshStandardMaterial color={clothing} roughness={0.88} />
        </mesh>
        <mesh position={[0, -0.78, 0]} castShadow>
          <sphereGeometry args={[0.115, 9, 7]} />
          <meshStandardMaterial color={skin} roughness={0.85} />
        </mesh>
        {person.task === 'build' && (
          <group position={[0, -0.93, 0.08]} rotation={[0.1, 0, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.045, 0.68, 7]} />
              <meshStandardMaterial color="#71513a" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.12, 0.42, 0.16]} />
              <meshStandardMaterial color="#596062" metalness={0.42} roughness={0.58} />
            </mesh>
          </group>
        )}
      </group>

      <group ref={leftLegRef} position={[-0.18, 1.12, 0]}>
        <mesh position={[0, -0.47, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.63, 4, 8]} />
          <meshStandardMaterial color="#4d5457" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.87, 0.09]} scale={[1, 0.62, 1.5]} castShadow>
          <capsuleGeometry args={[0.14, 0.12, 4, 8]} />
          <meshStandardMaterial color="#3e342d" roughness={0.94} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.18, 1.12, 0]}>
        <mesh position={[0, -0.47, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.63, 4, 8]} />
          <meshStandardMaterial color="#4d5457" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.87, 0.09]} scale={[1, 0.62, 1.5]} castShadow>
          <capsuleGeometry args={[0.14, 0.12, 4, 8]} />
          <meshStandardMaterial color="#3e342d" roughness={0.94} />
        </mesh>
      </group>
    </group>
  );
}
