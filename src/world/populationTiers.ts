export const DETAILED_PERSON_DISTANCE_METERS = 60;

const DETAILED_PERSON_DISTANCE_SQUARED = DETAILED_PERSON_DISTANCE_METERS ** 2;

export function shouldRenderDetailedPerson(
  distanceSquared: number,
  selected: boolean,
  hiddenForFirstPerson: boolean,
): boolean {
  return !hiddenForFirstPerson && (selected || distanceSquared < DETAILED_PERSON_DISTANCE_SQUARED);
}

export function shouldRenderFarPerson(
  distanceSquared: number,
  selected: boolean,
  hiddenForFirstPerson: boolean,
): boolean {
  return !hiddenForFirstPerson && !selected && distanceSquared >= DETAILED_PERSON_DISTANCE_SQUARED;
}
