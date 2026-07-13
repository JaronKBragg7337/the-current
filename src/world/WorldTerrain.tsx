import { useMemo } from 'react';
import { BufferAttribute, Color, PlaneGeometry } from 'three';

import { terrainHeight, worldRadius } from './terrain';

const TERRAIN_SIZE = 330;
const TERRAIN_SEGMENTS = 96;

export function Terrain() {
  const geometry = useMemo(() => {
    const nextGeometry = new PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS,
    );
    const positions = nextGeometry.attributes.position;
    if (positions === undefined) return nextGeometry;
    const colors = new Float32Array(positions.count * 3);
    const grass = new Color('#4d7658');
    const meadow = new Color('#73916a');
    const stone = new Color('#7b8174');
    const shore = new Color('#b3a77c');
    const color = new Color();

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = -positions.getY(index);
      const height = terrainHeight(x, z);
      positions.setZ(index, height);
      const radius = Math.hypot(x / 1.12, z);
      if (radius > worldRadius() - 16) color.copy(shore);
      else if (height > 2.8) color.copy(stone).lerp(grass, 0.4);
      else color.copy(grass).lerp(meadow, 0.35 + Math.sin(x * 0.11 + z * 0.07) * 0.15);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    nextGeometry.setAttribute('color', new BufferAttribute(colors, 3));
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, []);

  return (
    <group name="terrain">
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ cameraObstacle: true, cameraObstacleVolume: false }}
      >
        <meshStandardMaterial vertexColors roughness={0.93} metalness={0.01} />
      </mesh>
      <mesh position={[0, -3.15, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[245, 96]} />
        <meshPhysicalMaterial
          color="#2e6970"
          roughness={0.24}
          metalness={0.08}
          transmission={0.12}
          transparent
          opacity={0.9}
          clearcoat={0.38}
        />
      </mesh>
      <mesh position={[-126, -1.8, 18]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.4, 4.4, 32]} />
        <meshStandardMaterial color="#d0c396" roughness={1} />
      </mesh>
    </group>
  );
}
