import { BUILDING_FOOTPRINTS, type BuildingProjection, type PersonProjection } from '../simulation';

/** Stable presentation spacing for point-like authoritative work/home nodes. */
export function spreadCoLocatedPeople(
  people: readonly PersonProjection[],
  buildings: readonly BuildingProjection[],
): PersonProjection[] {
  const groups = new Map<string, PersonProjection[]>();
  for (const person of people) {
    const key = `${person.position.x.toFixed(2)}:${person.position.z.toFixed(2)}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [person]);
    else group.push(person);
  }

  const projected = new Map<string, PersonProjection>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      const person = group[0];
      if (person !== undefined) projected.set(person.id, person);
      continue;
    }
    const origin = group[0];
    if (origin === undefined) continue;
    const building = buildings.find((candidate) => (
      candidate.type !== 'road'
      && Math.abs(candidate.position.x - origin.position.x) < 0.1
      && Math.abs(candidate.position.z - origin.position.z) < 0.1
    ));
    const footprint = building === undefined ? null : BUILDING_FOOTPRINTS[building.type];
    const halfWidth = footprint === null ? 2.2 : Math.max(1.1, footprint.width / 2 - 1.15);
    const halfDepth = footprint === null ? 2.2 : Math.max(1.1, footprint.depth / 2 - 1.15);
    const columns = Math.ceil(Math.sqrt(group.length));
    const rows = Math.ceil(group.length / columns);

    for (const [index, person] of [...group].sort((a, b) => a.id.localeCompare(b.id)).entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = columns === 1 ? 0 : -halfWidth + (column / (columns - 1)) * halfWidth * 2;
      const z = rows === 1 ? 0 : -halfDepth + (row / (rows - 1)) * halfDepth * 2;
      projected.set(person.id, {
        ...person,
        position: { ...person.position, x: person.position.x + x, z: person.position.z + z },
      });
    }
  }
  return people.map((person) => projected.get(person.id) ?? person);
}

export function personInsideBuilding(person: PersonProjection | null, building: BuildingProjection): boolean {
  if (person === null || building.type === 'road' || building.type === 'farm' || building.type === 'well') return false;
  const footprint = BUILDING_FOOTPRINTS[building.type];
  return Math.abs(person.position.x - building.position.x) <= footprint.width / 2
    && Math.abs(person.position.z - building.position.z) <= footprint.depth / 2;
}
