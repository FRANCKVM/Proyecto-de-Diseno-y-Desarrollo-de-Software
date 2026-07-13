import type { BackendRuta, BackendSolicitudEnvio } from "@/types/backendSimulation.types";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import { parseUtcDateTimeMs } from "@/utils/utcDateTime";

export interface ShipmentRouteSegment {
  fromIcao: string;
  toIcao: string;
}

export interface ShipmentFocusTarget {
  focusedAirportIcao: string | null;
  focusedFlightId: string | null;
  shipmentRouteSegments?: ShipmentRouteSegment[];
}

const resolveReferenceMs = (
  referenceMinute?: number | null,
  simulationStart?: string | null
): number => {
  if (referenceMinute != null && simulationStart) {
    const start = parseUtcDateTimeMs(simulationStart);
    if (start !== null) return start + referenceMinute * 60_000;
  }
  return Date.now();
};

export const resolveShipmentFocusTarget = (
  shipment: BackendSolicitudEnvio,
  referenceMinute?: number | null,
  simulationStart?: string | null
): ShipmentFocusTarget => {
  if (shipment.estado === "INGRESADO") {
    return { focusedAirportIcao: shipment.origen.codigo, focusedFlightId: null };
  }
  if (shipment.estado === "COMPLETADO") {
    return { focusedAirportIcao: shipment.destino.codigo, focusedFlightId: null };
  }

  const occurrences = getShipmentRouteGroups(shipment)[0]?.ruta?.ocurrencias
    ?? shipment.ruta?.ocurrencias
    ?? [];
  if (occurrences.length === 0) {
    return { focusedAirportIcao: shipment.origen.codigo, focusedFlightId: null };
  }

  const referenceMs = resolveReferenceMs(referenceMinute, simulationStart);
  let previousAirportIcao = shipment.origen.codigo;
  for (const occurrence of occurrences) {
    const departureMs = parseUtcDateTimeMs(occurrence.fechaHoraSalida);
    const arrivalMs = parseUtcDateTimeMs(occurrence.fechaHoraLlegada);
    if (departureMs === null || arrivalMs === null) {
      continue;
    }
    if (referenceMs < departureMs) {
      return { focusedAirportIcao: previousAirportIcao, focusedFlightId: null };
    }
    if (referenceMs < arrivalMs) {
      return { focusedAirportIcao: null, focusedFlightId: String(occurrence.idOcurrencia) };
    }
    previousAirportIcao = occurrence.vuelo.hasta.codigo;
  }
  return { focusedAirportIcao: previousAirportIcao, focusedFlightId: null };
};

export const buildShipmentRouteSegments = (shipment: BackendSolicitudEnvio): ShipmentRouteSegment[] => {
  const occurrences = getShipmentRouteGroups(shipment).flatMap(
    (group) => group.ruta?.ocurrencias ?? []
  );
  return occurrences.length > 0
    ? occurrences.map(({ vuelo }) => ({ fromIcao: vuelo.desde.codigo, toIcao: vuelo.hasta.codigo }))
    : [{ fromIcao: shipment.origen.codigo, toIcao: shipment.destino.codigo }];
};

export const buildRouteSegments = (
  route: BackendRuta | null | undefined,
  fallback?: { fromIcao: string; toIcao: string }
): ShipmentRouteSegment[] => {
  const segments = (route?.ocurrencias ?? []).map(({ vuelo }) => ({
    fromIcao: vuelo.desde.codigo,
    toIcao: vuelo.hasta.codigo,
  }));
  return segments.length > 0 ? segments : fallback ? [fallback] : [];
};
