import { useLayoutEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';

import { terrainHeight, worldRadius } from './terrain';

interface TreeRecord {
  x: number;
  z: number;
  scale: number;
  tint: number;
}

const TREE_COUNT = 190;

function seededValue(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

export function Nature() {
  const trunksRef = useRef<InstancedMesh>(null);
  const crownsRef = useRef<InstancedMesh>(null);
  const trees = useMemo<TreeRecord[]>(() => {
    const nextTrees: TreeRecord[] = [];
    let candidate = 0;
    while (nextTrees.length < TREE_COUNT && candidate < 2_000) {
      const angle = seededValue(candidate, 1) * Math.PI * 2;
      const radius = 66 + seededValue(candidate, 2) * (worldRadius() - 76);
      const x = Math.cos(angle) * radius * 1.08;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x + 112, z - 18) > 10) {
        nextTrees.push({
          x,
          z,
          scale: 0.78 + seededValue(candidate, 3) * 0.9,
          tint: seededValue(candidate, 4),
        });
      }
      candidate += 1;
    }
    return nextTrees;
  }, []);

  useLayoutEffect(() => {
    const trunks = trunksRef.current;
    const crowns = crownsRef.current;
    if (trunks === null || crowns === null) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const position = new Vector3();
    const color = new Color();

    trees.forEach((tree, index) => {
      const ground = terrainHeight(tree.x, tree.z);
      position.set(tree.x, ground + 1.9 * tree.scale, tree.z);
      scale.set(0.42 * tree.scale, 1.8 * tree.scale, 0.42 * tree.scale);
      matrix.compose(position, quaternion, scale);
      trunks.setMatrixAt(index, matrix);
      trunks.setColorAt(index, color.set('#6a513b').lerp(new Color('#8b6844'), tree.tint));

      position.set(tree.x, ground + 4.35 * tree.scale, tree.z);
      scale.set(1.75 * tree.scale, 2.15 * tree.scale, 1.75 * tree.scale);
      matrix.compose(position, quaternion, scale);
      crowns.setMatrixAt(index, matrix);
      crowns.setColorAt(index, color.set('#315e48').lerp(new Color('#668454'), tree.tint));
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (trunks.instanceColor !== null) trunks.instanceColor.needsUpdate = true;
    if (crowns.instanceColor !== null) crowns.instanceColor.needsUpdate = true;
  }, [trees]);

  return (
    <group name="nature">
      <instancedMesh ref={trunksRef} args={[undefined, undefined, TREE_COUNT]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.5, 3.8, 7]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crownsRef} args={[undefined, undefined, TREE_COUNT]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.45, 0]} />
        <meshStandardMaterial roughness={0.94} />
      </instancedMesh>
    </group>
  );
}
