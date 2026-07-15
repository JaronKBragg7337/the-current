import type { BuildingProjection, PersonProjection, WorldProjection } from '../simulation';

export type CameraMode = 'first-person' | 'follow' | 'orbital';
export type EnvironmentOverlayMetric = 'contamination' | 'fertility' | 'waterQuality';

export type Selection =
  | { kind: 'building'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'vehicle'; id: string }
  | null;

export interface VehicleProjection {
  id: string;
  name: string;
  cargo: string;
  routeProgress: number;
  position: { x: number; y: number; z: number };
  yaw: number;
  active: boolean;
}
export interface RuntimeViewState {
  projection: WorldProjection;
  previousProjection: WorldProjection | null;
  selected: Selection;
  selectedPerson: PersonProjection | null;
  selectedBuilding: BuildingProjection | null;
  selectedVehicle: VehicleProjection | null;
  cameraMode: CameraMode;
  speed: number;
  paused: boolean;
  workerReady: boolean;
  saveStatus: 'error' | 'idle' | 'saving' | 'saved';
}
