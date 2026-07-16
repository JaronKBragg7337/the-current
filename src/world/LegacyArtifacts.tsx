import type { LegacyArtifactProjection } from '../simulation';
import { terrainHeight } from './terrain';

function FoundationFragments({ discovered }: { discovered: boolean }) {
  return (
    <group>
      {[-3.6, 0, 3.6].map((x, index) => (
        <mesh key={x} position={[x, 0.24, index === 1 ? 1.8 : -1.8]} rotation={[0, index * 0.13, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.48, 0.72]} />
          <meshStandardMaterial color={discovered ? '#847a65' : '#707465'} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function WellRing({ discovered }: { discovered: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <torusGeometry args={[2.15, 0.42, 8, 22]} />
        <meshStandardMaterial color={discovered ? '#827763' : '#6e7164'} roughness={1} />
      </mesh>
      <mesh position={[0.5, 0.18, -2.3]} rotation={[0.18, 0.3, 0.12]} castShadow>
        <boxGeometry args={[1.8, 0.38, 0.7]} />
        <meshStandardMaterial color="#756a58" roughness={1} />
      </mesh>
    </group>
  );
}

function SurveyFragments({ discovered }: { discovered: boolean }) {
  return (
    <group>
      {[-2.4, 0, 2.4].map((x, index) => (
        <mesh key={x} position={[x, 0.65 + index * 0.08, (index - 1) * 0.7]} rotation={[0.08 * index, 0.22 * index, 0.12 - index * 0.08]} castShadow>
          <boxGeometry args={[0.55, 1.3, 0.48]} />
          <meshStandardMaterial color={discovered ? '#96866b' : '#77786a'} roughness={0.98} />
        </mesh>
      ))}
    </group>
  );
}

export function LegacyArtifacts({ artifacts }: { artifacts: readonly LegacyArtifactProjection[] }) {
  return (
    <group name="era-zero-artifacts">
      {artifacts.map((artifact, index) => {
        const discovered = artifact.discoveredDay !== null;
        const y = terrainHeight(artifact.position.x, artifact.position.z);
        return (
          <group
            key={artifact.id}
            name={`legacy:${artifact.id}`}
            position={[artifact.position.x, y, artifact.position.z]}
            userData={{ entityId: artifact.id, entityKind: 'legacy-artifact', discovered }}
          >
            {index === 0 ? <FoundationFragments discovered={discovered} /> :
              index === 1 ? <WellRing discovered={discovered} /> :
                <SurveyFragments discovered={discovered} />}
          </group>
        );
      })}
    </group>
  );
}
