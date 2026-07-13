import { terrainHeight } from './terrain';

export function Landmarks() {
  const entryY = terrainHeight(-126, 18);
  const centerY = terrainHeight(0, 0);
  return (
    <group name="landmarks">
      <group position={[-126, entryY, 18]} rotation={[0, Math.PI / 2, 0]}>
        {[-2.2, 2.2].map((x) => (
          <mesh key={x} position={[x, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.38, 5, 10]} />
            <meshStandardMaterial color="#687d79" roughness={0.72} metalness={0.18} />
          </mesh>
        ))}
        <mesh position={[0, 4.82, 0]} castShadow>
          <boxGeometry args={[5.1, 0.42, 0.5]} />
          <meshStandardMaterial color="#687d79" roughness={0.72} metalness={0.18} />
        </mesh>
        <mesh position={[0, 5.25, 0]} rotation={[0, 0, Math.PI / 4]}>
          <octahedronGeometry args={[0.47, 0]} />
          <meshStandardMaterial color="#d5c27b" emissive="#8e762a" emissiveIntensity={0.58} />
        </mesh>
        <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.25, 2.7, 40]} />
          <meshStandardMaterial color="#c6b478" emissive="#756124" emissiveIntensity={0.22} />
        </mesh>
      </group>

      <group position={[0, centerY, 0]}>
        <mesh position={[0, 0.18, 0]} receiveShadow>
          <cylinderGeometry args={[5.7, 6.2, 0.36, 32]} />
          <meshStandardMaterial color="#8f8874" roughness={0.97} />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[2.25, 2.65, 1.7, 28]} />
          <meshStandardMaterial color="#868276" roughness={0.93} />
        </mesh>
        <mesh position={[0, 2.02, 0]}>
          <cylinderGeometry args={[1.55, 1.85, 0.4, 28]} />
          <meshStandardMaterial color="#7a756a" roughness={0.92} />
        </mesh>
        <mesh position={[0, 2.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.45, 28]} />
          <meshPhysicalMaterial color="#5a8f93" roughness={0.18} clearcoat={0.3} />
        </mesh>
        <mesh position={[0, 3.25, 0]}>
          <cylinderGeometry args={[0.12, 0.18, 2.1, 8]} />
          <meshStandardMaterial color="#6d7875" metalness={0.35} roughness={0.48} />
        </mesh>
        <mesh position={[0, 4.34, 0]}>
          <sphereGeometry args={[0.24, 12, 9]} />
          <meshStandardMaterial color="#e4d38b" emissive="#987d28" emissiveIntensity={0.65} />
        </mesh>
      </group>
    </group>
  );
}
