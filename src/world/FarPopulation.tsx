import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';

import type { CameraMode } from '../app/types';
import type { PersonProjection } from '../simulation';
import { shouldRenderFarPerson } from './populationTiers';
import { deterministicUnit, terrainHeight } from './terrain';

interface FarPopulationProps {
  people: PersonProjection[];
  selectedPersonId: string | null;
  cameraMode: CameraMode;
  onSelect: (personId: string) => void;
}

const BODY_COLORS = ['#94704b', '#687c61', '#6f7190', '#8e5f5a', '#5e7679'] as const;

interface FarPersonTransform {
  ground: number;
  height: number;
  x: number;
  yaw: number;
  z: number;
}

export function FarPopulation({ people, selectedPersonId, cameraMode, onSelect }: FarPopulationProps) {
  const bodiesRef = useRef<InstancedMesh>(null);
  const headsRef = useRef<InstancedMesh>(null);
  const matrix = useMemo(() => new Matrix4(), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const position = useMemo(() => new Vector3(), []);
  const scale = useMemo(() => new Vector3(), []);
  const yAxis = useMemo(() => new Vector3(0, 1, 0), []);
  const visibilityRef = useRef<Array<boolean | undefined>>([]);
  const transforms = useMemo<FarPersonTransform[]>(
    () => people.map((person) => ({
      ground: terrainHeight(person.position.x, person.position.z),
      height: person.heightMeters,
      x: person.position.x,
      yaw: person.yaw,
      z: person.position.z,
    })),
    [people],
  );

  useLayoutEffect(() => {
    const bodies = bodiesRef.current;
    const heads = headsRef.current;
    if (bodies === null || heads === null) return;
    visibilityRef.current = [];
    const color = new Color();
    people.forEach((person, index) => {
      bodies.setColorAt(
        index,
        color.set(BODY_COLORS[Math.floor(deterministicUnit(person.id) * BODY_COLORS.length)] ?? '#6d716c'),
      );
      const skinLightness = 0.28 + deterministicUnit(`${person.id}:skin`) * 0.52;
      heads.setColorAt(index, color.setHSL(0.075, 0.38, skinLightness));
    });
    if (bodies.instanceColor !== null) bodies.instanceColor.needsUpdate = true;
    if (heads.instanceColor !== null) heads.instanceColor.needsUpdate = true;
  }, [people]);

  useFrame(({ camera }) => {
    const bodies = bodiesRef.current;
    const heads = headsRef.current;
    if (bodies === null || heads === null) return;
    let matricesChanged = false;
    people.forEach((person, index) => {
      const transform = transforms[index];
      if (transform === undefined) return;
      const deltaX = camera.position.x - transform.x;
      const deltaY = camera.position.y - transform.ground;
      const deltaZ = camera.position.z - transform.z;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
      const selected = person.id === selectedPersonId;
      const hiddenForFirstPerson = person.id === selectedPersonId && cameraMode === 'first-person';
      const visible = shouldRenderFarPerson(distanceSquared, selected, hiddenForFirstPerson);
      if (visibilityRef.current[index] === visible) return;

      visibilityRef.current[index] = visible;
      matricesChanged = true;
      quaternion.setFromAxisAngle(yAxis, transform.yaw);

      position.set(transform.x, transform.ground + transform.height * 0.48, transform.z);
      scale.set(
        visible ? transform.height * 0.19 : 0,
        visible ? transform.height * 0.32 : 0,
        visible ? transform.height * 0.19 : 0,
      );
      matrix.compose(position, quaternion, scale);
      bodies.setMatrixAt(index, matrix);

      position.set(transform.x, transform.ground + transform.height * 0.84, transform.z);
      scale.setScalar(visible ? transform.height * 0.145 : 0);
      matrix.compose(position, quaternion, scale);
      heads.setMatrixAt(index, matrix);
    });
    if (matricesChanged) {
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    }
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.instanceId === undefined) return;
    const person = people[event.instanceId];
    if (person !== undefined) onSelect(person.id);
  };

  return (
    <group name="far-population">
      <instancedMesh
        ref={bodiesRef}
        args={[undefined, undefined, people.length]}
        frustumCulled={false}
        onClick={handleSelect}
        castShadow
      >
        <capsuleGeometry args={[1, 1.5, 3, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={headsRef}
        args={[undefined, undefined, people.length]}
        frustumCulled={false}
        onClick={handleSelect}
      >
        <sphereGeometry args={[1, 7, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
