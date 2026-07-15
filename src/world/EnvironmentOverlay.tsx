import { useLayoutEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';

import type { EnvironmentOverlayMetric } from '../app/types';
import { BUILDING_FOOTPRINTS, type BuildingProjection } from '../simulation';
import { environmentOverlayColor, environmentOverlayValue } from './environmentOverlayModel';
import { terrainHeight } from './terrain';

interface EnvironmentOverlayProps {
  buildings: BuildingProjection[];
  metric: EnvironmentOverlayMetric;
}

export function EnvironmentOverlay({ buildings, metric }: EnvironmentOverlayProps) {
  const sites = useMemo(
    () => buildings.filter((building) => building.type !== 'road'),
    [buildings],
  );
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const scale = new Vector3();
    const color = new Color();
    sites.forEach((building, index) => {
      const footprint = BUILDING_FOOTPRINTS[building.type];
      const radius = Math.max(footprint.width, footprint.depth) * 0.72 + 1.4;
      position.set(
        building.position.x,
        terrainHeight(building.position.x, building.position.z) + 0.055,
        building.position.z,
      );
      scale.set(radius, radius, 1);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(environmentOverlayColor(metric, environmentOverlayValue(building, metric))));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [metric, sites]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, sites.length]}
      frustumCulled={false}
      raycast={() => undefined}
      renderOrder={-1}
    >
      <ringGeometry args={[0.72, 1, 32]} />
      <meshBasicMaterial transparent opacity={0.56} depthWrite={false} toneMapped={false} vertexColors />
    </instancedMesh>
  );
}
