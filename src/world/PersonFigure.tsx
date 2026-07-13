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
  artist: '#a05c83', builder: '#b77b48', caregiver: '#8a719d', explorer: '#6f7955',
  farmer: '#6f824f', healer: '#5f8990', hunter: '#6c6848', inventor: '#6d7398',
  laborer: '#8a704f', mechanic: '#59676b', organizer: '#8d6158', researcher: '#646f98',
  teacher: '#8a6d94', trader: '#9b744f', unemployed: '#716d68',
};

const SKIN_TONES = ['#f0c7a5', '#dba77e', '#bb7e58', '#8e593f', '#643d31'] as const;
const HAIR_TONES = ['#2e211e', '#5b3928', '#8c6542', '#bc925f', '#4c4542'] as const;

function paletteValue(values: readonly string[], seed: number): string {
  return values[Math.min(values.length - 1, Math.floor(seed * values.length))] ?? values[0] ?? '#777777';
}

function OccupationEquipment({ person }: { person: PersonProjection }) {
  if (person.task === 'build' || person.occupation === 'builder' || person.occupation === 'mechanic') {
    return (
      <group position={[0, -0.68, 0.04]} rotation={[0.08, 0, 0]}>
        <mesh position={[0, -0.15, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.033, 0.52, 7]} />
          <meshStandardMaterial color="#71513a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[0.09, 0.3, 0.12]} />
          <meshStandardMaterial color="#596062" metalness={0.42} roughness={0.58} />
        </mesh>
      </group>
    );
  }
  if (person.task === 'fetch-water') {
    return (
      <group position={[0, -0.71, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.14, 0.3, 10]} />
          <meshStandardMaterial color="#73888b" metalness={0.18} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.018, 5, 12, Math.PI]} />
          <meshStandardMaterial color="#4d5b5e" />
        </mesh>
      </group>
    );
  }
  if (person.task === 'trade' || person.occupation === 'trader') {
    return (
      <mesh position={[0, -0.63, 0.06]} castShadow>
        <boxGeometry args={[0.27, 0.22, 0.2]} />
        <meshStandardMaterial color="#8e6840" roughness={0.92} />
      </mesh>
    );
  }
  return null;
}

function Hair({ style, color }: { style: number; color: string }) {
  return (
    <group>
      <mesh position={[0, 1.64, -0.015]} scale={[1.03, 0.62, 1.01]} castShadow>
        <sphereGeometry args={[0.178, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={color} roughness={0.96} />
      </mesh>
      {style === 1 && (
        <mesh position={[0, 1.65, -0.165]} castShadow>
          <sphereGeometry args={[0.1, 9, 7]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
      )}
      {style === 2 && (
        <mesh position={[0.145, 1.59, -0.04]} scale={[0.42, 0.9, 0.72]} castShadow>
          <sphereGeometry args={[0.17, 9, 7]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
      )}
      {style === 3 && (
        <mesh position={[0, 1.5, -0.135]} scale={[0.82, 1.5, 0.55]} castShadow>
          <capsuleGeometry args={[0.1, 0.18, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
      )}
    </group>
  );
}

export function PersonFigure({ person, selected, cameraMode, onSelect, onFollow }: PersonFigureProps) {
  const rootRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const torsoRef = useRef<Mesh>(null);
  const { camera } = useThree();
  const target = useMemo(() => new Vector3(), []);
  const groundHeight = useMemo(() => terrainHeight(person.position.x, person.position.z), [person.position.x, person.position.z]);
  const bodySeed = deterministicUnit(`${person.id}:body`);
  const skin = paletteValue(SKIN_TONES, deterministicUnit(`${person.id}:skin`));
  const hair = person.lifeStage === 'elder' ? '#b9b5aa' : person.lifeStage === 'older-adult' ? '#8e8980' : paletteValue(HAIR_TONES, deterministicUnit(`${person.id}:hair`));
  const clothing = OCCUPATION_COLORS[person.occupation];
  const accent = person.biologicalSex === 'female' ? '#c6a16d' : '#7d8d82';
  const heightScale = person.heightMeters / 1.72;
  const widthScale = 0.92 + bodySeed * 0.16;
  const shoulder = person.biologicalSex === 'male' ? 0.34 : 0.3;
  const hip = person.biologicalSex === 'female' ? 0.18 : 0.16;
  const hairStyle = Math.floor(deterministicUnit(`${person.id}:hair-style`) * 4);
  const firstPersonSelf = selected && cameraMode === 'first-person';
  const wearsApron = ['farmer', 'healer', 'caregiver', 'trader'].includes(person.occupation);
  const wearsHat = ['farmer', 'builder', 'explorer', 'hunter'].includes(person.occupation);

  useFrame(({ clock }, delta) => {
    const root = rootRef.current;
    if (root === null) return;
    target.set(person.position.x, groundHeight, person.position.z);
    root.visible = shouldRenderDetailedPerson(camera.position.distanceToSquared(target), selected, firstPersonSelf);
    if (!root.visible) return;

    root.position.x = MathUtils.damp(root.position.x, target.x, 4.5, delta);
    root.position.y = MathUtils.damp(root.position.y, target.y, 6, delta);
    root.position.z = MathUtils.damp(root.position.z, target.z, 4.5, delta);
    root.rotation.y = MathUtils.damp(root.rotation.y, person.yaw, 5, delta);

    const walking = person.task === 'travel' || person.task === 'fetch-water';
    const working = ['build', 'work', 'trade', 'care', 'heal'].includes(person.task);
    const active = walking || working;
    const agePace = person.lifeStage === 'elder' ? 0.72 : person.lifeStage === 'child' ? 1.18 : 1;
    const phase = clock.elapsedTime * (walking ? 6.2 : working ? 4.5 : 2.2) * agePace + deterministicUnit(person.id) * Math.PI * 2;
    const stride = active ? Math.sin(phase) * (person.health / 100) * (walking ? 0.55 : 0.24) : Math.sin(phase * 0.35) * 0.025;
    if (leftArmRef.current !== null) leftArmRef.current.rotation.x = stride;
    if (rightArmRef.current !== null) {
      rightArmRef.current.rotation.x = person.task === 'build' ? -0.62 + Math.sin(phase) * 0.7 : person.task === 'socialize' ? -0.2 : -stride;
      rightArmRef.current.rotation.z = person.task === 'socialize' ? -0.58 : -0.06;
    }
    if (leftLegRef.current !== null) leftLegRef.current.rotation.x = -stride * 0.72;
    if (rightLegRef.current !== null) rightLegRef.current.rotation.x = stride * 0.72;
    if (torsoRef.current !== null) torsoRef.current.position.y = 1.18 + (walking ? Math.abs(Math.sin(phase)) * 0.018 : 0);
    if (bodyRef.current !== null) {
      const ageLean = person.lifeStage === 'elder' ? 0.09 : person.lifeStage === 'older-adult' ? 0.04 : 0;
      bodyRef.current.rotation.x = ageLean;
      bodyRef.current.rotation.z = person.health < 40 ? 0.06 : 0;
      bodyRef.current.position.y = person.task === 'rest' ? -0.08 : 0;
    }
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(person.id); };
  const handleFollow = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onFollow(person.id); };

  return (
    <group
      ref={rootRef}
      name={`person:${person.id}`}
      position={[person.position.x, groundHeight, person.position.z]}
      rotation={[0, person.yaw, 0]}
      scale={[heightScale * widthScale, heightScale, heightScale * widthScale]}
      onClick={handleSelect}
      onDoubleClick={handleFollow}
      userData={{ entityId: person.id, entityKind: 'person' }}
    >
      {selected && (
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.44, 0.54, 32]} />
          <meshBasicMaterial color="#f6dd85" transparent opacity={0.95} depthWrite={false} />
        </mesh>
      )}
      <group ref={bodyRef}>
        <mesh ref={torsoRef} position={[0, 1.18, 0]} scale={[person.biologicalSex === 'male' ? 1.08 : 0.96, 1, 0.8]} castShadow>
          <capsuleGeometry args={[0.22, 0.42, 6, 10]} />
          <meshStandardMaterial color={clothing} roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.88, 0]} scale={[person.biologicalSex === 'female' ? 1.14 : 1, 0.65, 0.78]} castShadow>
          <sphereGeometry args={[0.24, 10, 8]} />
          <meshStandardMaterial color={person.biologicalSex === 'female' ? accent : clothing} roughness={0.9} />
        </mesh>
        {wearsApron && (
          <mesh position={[0, 1.13, 0.194]} castShadow>
            <boxGeometry args={[0.3, 0.52, 0.025]} />
            <meshStandardMaterial color="#d0bd92" roughness={0.96} />
          </mesh>
        )}
        <group visible={!firstPersonSelf}>
          <mesh position={[0, 1.535, 0]} castShadow>
            <sphereGeometry args={[0.178, 14, 11]} />
            <meshStandardMaterial color={skin} roughness={0.84} />
          </mesh>
          <Hair style={hairStyle} color={hair} />
          <mesh position={[0, 1.535, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.03, 0.065, 8]} />
            <meshStandardMaterial color={skin} roughness={0.85} />
          </mesh>
          {wearsHat && (
            <group position={[0, 1.71, 0]}>
              <mesh scale={[1, 0.45, 1]} castShadow><sphereGeometry args={[0.19, 10, 7]} /><meshStandardMaterial color="#846b45" roughness={0.96} /></mesh>
              <mesh position={[0, -0.02, 0.04]} castShadow><cylinderGeometry args={[0.25, 0.25, 0.025, 14]} /><meshStandardMaterial color="#846b45" roughness={0.96} /></mesh>
            </group>
          )}
        </group>
        <group ref={leftArmRef} position={[-shoulder, 1.36, 0]} rotation={[0, 0, 0.06]}>
          <mesh position={[0, -0.32, 0]} castShadow><capsuleGeometry args={[0.075, 0.42, 4, 8]} /><meshStandardMaterial color={clothing} roughness={0.88} /></mesh>
          <mesh position={[0, -0.59, 0]} castShadow><sphereGeometry args={[0.08, 9, 7]} /><meshStandardMaterial color={skin} roughness={0.85} /></mesh>
        </group>
        <group ref={rightArmRef} position={[shoulder, 1.36, 0]} rotation={[0, 0, -0.06]}>
          <mesh position={[0, -0.32, 0]} castShadow><capsuleGeometry args={[0.075, 0.42, 4, 8]} /><meshStandardMaterial color={clothing} roughness={0.88} /></mesh>
          <mesh position={[0, -0.59, 0]} castShadow><sphereGeometry args={[0.08, 9, 7]} /><meshStandardMaterial color={skin} roughness={0.85} /></mesh>
          <OccupationEquipment person={person} />
        </group>
        <group ref={leftLegRef} position={[-hip, 0.84, 0]}>
          <mesh position={[0, -0.35, 0]} castShadow><capsuleGeometry args={[0.09, 0.5, 4, 8]} /><meshStandardMaterial color="#4d5457" roughness={0.9} /></mesh>
          <mesh position={[0, -0.74, 0.07]} scale={[1, 0.62, 1.55]} castShadow><capsuleGeometry args={[0.095, 0.08, 4, 8]} /><meshStandardMaterial color="#3e342d" roughness={0.94} /></mesh>
        </group>
        <group ref={rightLegRef} position={[hip, 0.84, 0]}>
          <mesh position={[0, -0.35, 0]} castShadow><capsuleGeometry args={[0.09, 0.5, 4, 8]} /><meshStandardMaterial color="#4d5457" roughness={0.9} /></mesh>
          <mesh position={[0, -0.74, 0.07]} scale={[1, 0.62, 1.55]} castShadow><capsuleGeometry args={[0.095, 0.08, 4, 8]} /><meshStandardMaterial color="#3e342d" roughness={0.94} /></mesh>
        </group>
      </group>
    </group>
  );
}
