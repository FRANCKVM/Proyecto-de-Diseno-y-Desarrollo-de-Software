import type {
  BackendListadoStatus,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import { parseUtcDateTimeMs } from "@/utils/utcDateTime";

export type ShipmentViewMode = "todos" | BackendListadoStatus;

export const DELIVERY_RELEASE_DELAY_MINUTES = 15;

export const EMPTY_SHIPMENT_STATUS_COUNTS: Record<string, number> = {
  todos: 0,
  registrados: 0,
  planificados: 0,
  "en-transito": 0,
  completados: 0,
  entregados: 0,
};

export const SHIPMENT_STATUS_OPTIONS: BackendListadoStatus[] = [
  "registrados",
  "planificados",
  "en-transito",
  "completados",
  "entregados",
];

export const SHIPMENT_STATUS_LABEL: Record<BackendListadoStatus, string> = {
  registrados: "Registrados",
  planificados: "Planificados",
  "en-transito": "En transito",
  completados: "Completados",
  entregados: "Entregados",
};

export const SHIPMENT_STATUS_BADGE_LABEL: Record<BackendListadoStatus, string> = {
  registrados: "Registrado",
  planificados: "Planificado",
  "en-transito": "En transito",
  completados: "Completado",
  entregados: "Entregado",
};

export const getShipmentStatusTagVariant = (
  status: BackendListadoStatus
): "primary" | "neutral" | "normal" | "elevado" => {
  if (status === "entregados") return "normal";
  if (status === "completados") return "neutral";
  if (status === "registrados") return "elevado";
  return "primary";
};

const parseTimelineDateTimeMs = (value: string | null | undefined): number | null =>
  parseUtcDateTimeMs(value);

export const getShipmentTimelineMinutes = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): { firstDeparture: number | null; lastArrival: number | null } => {
  const routeGroups = getShipmentRouteGroups(shipment);

  if (routeGroups.length === 0) {
    return { firstDeparture: null, lastArrival: null };
  }

  let firstDeparture: number | null = null;
  let lastArrival: number | null = null;

  for (const group of routeGroups) {
    for (const occurrence of group.ruta?.ocurrencias ?? []) {
      const baseMs =
        parseTimelineDateTimeMs(simulationStart) ??
        parseUtcDateTimeMs(`${shipment.fecha}T00:00:00`);
      const departureMs = parseUtcDateTimeMs(occurrence.fechaHoraSalida);
      const arrivalMs = parseUtcDateTimeMs(occurrence.fechaHoraLlegada);

      if (baseMs === null || departureMs === null || arrivalMs === null) {
        continue;
      }

      const departure = Math.round((departureMs - baseMs) / 60_000);
      const arrival = Math.round((arrivalMs - baseMs) / 60_000);

      firstDeparture =
        firstDeparture === null ? departure : Math.min(firstDeparture, departure);
      lastArrival = lastArrival === null ? arrival : Math.max(lastArrival, arrival);
    }
  }

  return { firstDeparture, lastArrival };
};

export const normalizeBackendShipmentStatus = (
  estado: string | null | undefined
): BackendListadoStatus | null => {
  switch (estado) {
    case "REGISTRADO":
      return "registrados";
    case "PLANIFICADO":
      return "planificados";
    case "EN_TRANSITO":
      return "en-transito";
    case "COMPLETADO":
      return "completados";
    case "ENTREGADO":
      return "entregados";
    default:
      return null;
  }
};

export const resolveShipmentListStatus = (
  shipment: BackendSolicitudEnvio,
  referenceMinute?: number | null,
  simulationStart?: string | null
): BackendListadoStatus => {
  const routeGroups = getShipmentRouteGroups(shipment);
  if (routeGroups.length === 0) {
    return "registrados";
  }

  if (referenceMinute === null || referenceMinute === undefined) {
    return normalizeBackendShipmentStatus(shipment.estado) ?? "planificados";
  }

  const timeline = getShipmentTimelineMinutes(shipment, simulationStart);
  if (
    timeline.lastArrival !== null &&
    referenceMinute >= timeline.lastArrival + DELIVERY_RELEASE_DELAY_MINUTES
  ) {
    return "entregados";
  }

  if (timeline.lastArrival !== null && referenceMinute >= timeline.lastArrival) {
    return "completados";
  }

  if (
    timeline.firstDeparture !== null &&
    referenceMinute >= timeline.firstDeparture
  ) {
    return "en-transito";
  }

  return "planificados";
};
