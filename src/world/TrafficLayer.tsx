import type { VehicleProjection } from '../app/types';
import { VEHICLE_ROUTES } from './vehicles';
import { VehicleFigure } from './VehicleFigure';

interface TrafficLayerProps {
  vehicles: VehicleProjection[];
  selectedVehicleId: string | null;
  onSelect: (vehicleId: string) => void;
}

export function TrafficLayer({ vehicles, selectedVehicleId, onSelect }: TrafficLayerProps) {
  return (
    <group name="traffic">
      {vehicles.map((vehicle, index) => {
        const route = VEHICLE_ROUTES[index % VEHICLE_ROUTES.length] ?? VEHICLE_ROUTES[0];
        if (route === undefined) return null;
        return (
          <VehicleFigure
            key={vehicle.id}
            vehicle={vehicle}
            route={route}
            selected={selectedVehicleId === vehicle.id}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}
