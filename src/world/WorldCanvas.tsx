import { AdaptiveDpr, Sky } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { memo, useMemo } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';

import type { CameraMode, Selection, VehicleProjection } from '../app/types';
import type { WorldProjection } from '../simulation';
import { BuildingFigure } from './BuildingFigure';
import type { RenderDiagnostics } from './DiagnosticsBridge';
import { DiagnosticsBridge } from './DiagnosticsBridge';
import { EventLayer } from './EventLayer';
import { FarPopulation } from './FarPopulation';
import { Landmarks } from './Landmarks';
import { Nature } from './Nature';
import { PersonFigure } from './PersonFigure';
import { RoadNetwork } from './RoadNetwork';
import type { CameraDiagnostics } from './SpectatorCamera';
import { SpectatorCamera } from './SpectatorCamera';
import { Terrain } from './WorldTerrain';
import { TrafficLayer } from './TrafficLayer';
import { terrainHeight } from './terrain';

interface WorldCanvasProps {
  projection: WorldProjection;
  vehicles: VehicleProjection[];
  selection: Selection;
  cameraMode: CameraMode;
  onSelect: (selection: Selection) => void;
  onCameraModeChange: (mode: CameraMode) => void;
  onCameraDiagnostics: (diagnostics: CameraDiagnostics) => void;
  onDiagnostics: (diagnostics: RenderDiagnostics) => void;
}

function WorldCanvasComponent({
  projection,
  vehicles,
  selection,
  cameraMode,
  onSelect,
  onCameraModeChange,
  onCameraDiagnostics,
  onDiagnostics,
}: WorldCanvasProps) {
  const selectedPerson = selection?.kind === 'person'
    ? projection.people.find((person) => person.id === selection.id) ?? null
    : null;
  const selectedBuilding = selection?.kind === 'building'
    ? projection.buildings.find((building) => building.id === selection.id) ?? null
    : null;
  const selectedVehicle = selection?.kind === 'vehicle'
    ? vehicles.find((vehicle) => vehicle.id === selection.id) ?? null
    : null;
  const focusPosition = useMemo<readonly [number, number, number] | null>(() => {
    if (selectedPerson !== null) {
      return [
        selectedPerson.position.x,
        terrainHeight(selectedPerson.position.x, selectedPerson.position.z) + selectedPerson.heightMeters * 0.55,
        selectedPerson.position.z,
      ];
    }
    if (selectedBuilding !== null) {
      return [
        selectedBuilding.position.x,
        terrainHeight(selectedBuilding.position.x, selectedBuilding.position.z) + 1.4,
        selectedBuilding.position.z,
      ];
    }
    if (selectedVehicle !== null) {
      return [selectedVehicle.position.x, selectedVehicle.position.y + 1, selectedVehicle.position.z];
    }
    return null;
  }, [selectedBuilding, selectedPerson, selectedVehicle]);

  return (
    <Canvas
      className="world-canvas"
      shadows="basic"
      dpr={[1, 1.8]}
      camera={{ position: [96, 76, 96], fov: 48, near: 0.08, far: 620 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.shadowMap.autoUpdate = true;
      }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#a7bac0']} />
      <fog attach="fog" args={['#a7bac0', 135, 335]} />
      <ambientLight intensity={0.38} color="#d6e1d3" />
      <hemisphereLight args={['#b7d1d7', '#54604d', 1.28]} />
      <directionalLight
        position={[72, 108, 38]}
        intensity={2.1}
        color="#fff1cf"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={15}
        shadow-camera-far={260}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-bias={-0.00018}
      />
      <Sky distance={450_000} sunPosition={[72, 108, 38]} turbidity={3.8} rayleigh={1.7} mieCoefficient={0.006} mieDirectionalG={0.82} />

      <Terrain />
      <RoadNetwork buildings={projection.buildings} />
      <Nature />
      <Landmarks />
      {projection.buildings.map((building) => (
        <BuildingFigure
          key={building.id}
          building={building}
          selected={selection?.kind === 'building' && selection.id === building.id}
          onSelect={(buildingId) => onSelect({ kind: 'building', id: buildingId })}
        />
      ))}
      <FarPopulation
        people={projection.people}
        selectedPersonId={selectedPerson?.id ?? null}
        cameraMode={cameraMode}
        onSelect={(personId) => onSelect({ kind: 'person', id: personId })}
      />
      {projection.people.map((person) => (
        <PersonFigure
          key={person.id}
          person={person}
          selected={selection?.kind === 'person' && selection.id === person.id}
          cameraMode={cameraMode}
          onSelect={(personId) => onSelect({ kind: 'person', id: personId })}
          onFollow={(personId) => {
            onSelect({ kind: 'person', id: personId });
            onCameraModeChange('follow');
          }}
        />
      ))}
      <TrafficLayer
        vehicles={vehicles}
        selectedVehicleId={selectedVehicle?.id ?? null}
        onSelect={(vehicleId) => onSelect({ kind: 'vehicle', id: vehicleId })}
      />
      <EventLayer
        events={projection.recentEvents}
        people={projection.people}
        buildings={projection.buildings}
      />
      <SpectatorCamera
        mode={cameraMode}
        selectedPerson={selectedPerson}
        focusPosition={focusPosition}
        onDiagnostics={onCameraDiagnostics}
      />
      <AdaptiveDpr pixelated />
      <DiagnosticsBridge onSample={onDiagnostics} />
    </Canvas>
  );
}

export const WorldCanvas = memo(WorldCanvasComponent);
