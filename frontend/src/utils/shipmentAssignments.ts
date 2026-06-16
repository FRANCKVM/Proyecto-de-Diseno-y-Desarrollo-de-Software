import type {
  BackendRuta,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";

export interface ShipmentRouteGroup {
  ruta: BackendRuta | null;
  cantidadBolsas: number;
}

export const getShipmentRouteGroups = (
  shipment: BackendSolicitudEnvio
): ShipmentRouteGroup[] => {
  const assignments = shipment.asignaciones ?? [];
  const assignedGroups = assignments
    .filter((assignment) => assignment.ruta?.vuelos?.length)
    .map((assignment) => ({
      ruta: assignment.ruta,
      cantidadBolsas: assignment.cantidadBolsas ?? 0,
    }));

  if (assignedGroups.length > 0) {
    return assignedGroups;
  }

  if (shipment.ruta?.vuelos?.length) {
    return [
      {
        ruta: shipment.ruta,
        cantidadBolsas: shipment.contarBolsas ?? 0,
      },
    ];
  }

  return [];
};

export const getAssignedBags = (shipment: BackendSolicitudEnvio): number =>
  getShipmentRouteGroups(shipment).reduce(
    (total, group) => total + group.cantidadBolsas,
    0
  );
