import type { BuildingProjection, PersonProjection, SimulationEvent } from '../simulation';
import { terrainHeight } from './terrain';

interface EventLayerProps {
  events: SimulationEvent[];
  people: PersonProjection[];
  buildings: BuildingProjection[];
}
const EVENT_COLORS: Partial<Record<SimulationEvent['type'], string>> = {
  arrival: '#9bd7ca',
  birth: '#f4d98e',
  death: '#8791a2',
  'building-completed': '#e8b963',
  'breakthrough-adopted': '#a7c8ff',
  'intervention-resolved': '#d7a8e5',
  shortage: '#e47b67',
};

export function EventLayer({ events, people, buildings }: EventLayerProps) {
  const visibleEvents = events.filter((event) => EVENT_COLORS[event.type] !== undefined).slice(-8);
  return (
    <group name="event-markers">
      {visibleEvents.map((event, index) => {
        const entityId = event.entityIds[0];
        const person = people.find((candidate) => candidate.id === entityId);
        const building = buildings.find((candidate) => candidate.id === entityId);
        const x = person?.position.x ?? building?.position.x ?? -5 + index * 1.7;
        const z = person?.position.z ?? building?.position.z ?? 5 + (index % 3) * 1.7;
        const y = terrainHeight(x, z) + 0.12;
        const color = EVENT_COLORS[event.type] ?? '#d9c99a';
        return (
          <group key={event.sequence} position={[x, y, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.85 + index * 0.03, 1.02 + index * 0.03, 32]} />
              <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0.75, 0]}>
              <sphereGeometry args={[0.11, 8, 7]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <pointLight position={[0, 0.45, 0]} color={color} intensity={0.7} distance={4.5} />
          </group>
        );
      })}
    </group>
  );
}
