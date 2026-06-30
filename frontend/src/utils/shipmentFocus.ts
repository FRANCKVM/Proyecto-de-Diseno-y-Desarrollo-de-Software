import type {
  BackendRuta,
  BackendSolicitudEnvio,
  BackendVuelo,
} from "@/types/backendSimulation.types";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";

const DAY_MINUTES = 24 * 60;

export interface ShipmentRouteSegment {
  fromIcao: string;
  toIcao: string;
}

export interface ShipmentFocusTarget {
  focusedAirportIcao: string | null;
  focusedFlightId: string | null;
  shipmentRouteSegments?: ShipmentRouteSegment[];
}

const getCurrentUtcMinute = (): number => {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

const normalizeMinute = (minute: number): number =>
  ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const parseLocalDateTimeMs = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const parseShipmentUtcMinute = (shipment: BackendSolicitudEnvio): number => {
  const [hour = "0", minute = "0"] = (shipment.hora ?? "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
};

const getShipmentStartMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number => {
  const simulationStartMs = parseLocalDateTimeMs(simulationStart);
  const shipmentMs = parseLocalDateTimeMs(`${shipment.fecha}T${shipment.hora}`);

  if (simulationStartMs === null || shipmentMs === null) {
    return parseShipmentUtcMinute(shipment);
  }

  return Math.max(0, Math.floor((shipmentMs - simulationStartMs) / 60_000));
};

const buildFlightWindow = (
  flight: BackendVuelo,
  earliestMinute: number
): { departure: number; arrival: number } => {
  const departureBase = normalizeMinute(flight.salidaUtcMin);
  let arrivalBase = flight.llegadaUtcMin;

  while (arrivalBase <= departureBase) {
    arrivalBase += DAY_MINUTES;
  }

  const duration = Math.max(1, arrivalBase - departureBase);
  const occurrenceOffset = Math.max(
    0,
    Math.ceil((earliestMinute - departureBase) / DAY_MINUTES)
  );
  const departure = departureBase + occurrenceOffset * DAY_MINUTES;

  return {
    departure,
    arrival: departure + duration,
  };
};

export const resolveShipmentFocusTarget = (
  shipment: BackendSolicitudEnvio,
  referenceMinute?: number | null,
  simulationStart?: string | null
): ShipmentFocusTarget => {
  if (shipment.estado === "INGRESADO") {
    return {
      focusedAirportIcao: shipment.origen.codigo,
      focusedFlightId: null,
    };
  }

  if (shipment.estado === "COMPLETADO") {
    return {
      focusedAirportIcao: shipment.destino.codigo,
      focusedFlightId: null,
    };
  }

  const routeFlights = shipment.ruta?.vuelos ?? [];
  const routeGroups = getShipmentRouteGroups(shipment);
  const focusRouteFlights = routeGroups[0]?.ruta?.vuelos ?? routeFlights;
  if (focusRouteFlights.length === 0) {
    return {
      focusedAirportIcao: shipment.origen.codigo,
      focusedFlightId: null,
    };
  }

  const reference = referenceMinute ?? getCurrentUtcMinute();
  let previousAirportIcao = shipment.origen.codigo;
  let earliestMinute = getShipmentStartMinute(shipment, simulationStart);

  for (const flight of focusRouteFlights) {
    const window = buildFlightWindow(flight, earliestMinute);

    if (reference < window.departure) {
      return {
        focusedAirportIcao: previousAirportIcao,
        focusedFlightId: null,
      };
    }

    if (reference >= window.departure && reference < window.arrival) {
      return {
        focusedAirportIcao: null,
        focusedFlightId: String(flight.idVuelo),
      };
    }

    previousAirportIcao = flight.hasta.codigo;
    earliestMinute = window.arrival;
  }

  return {
    focusedAirportIcao: previousAirportIcao,
    focusedFlightId: null,
  };
};

export const buildShipmentRouteSegments = (
  shipment: BackendSolicitudEnvio
): ShipmentRouteSegment[] => {
  const routeFlights = getShipmentRouteGroups(shipment).flatMap(
    (group) => group.ruta?.vuelos ?? []
  );

  if (routeFlights.length > 0) {
    return routeFlights.map((flight) => ({
      fromIcao: flight.desde.codigo,
      toIcao: flight.hasta.codigo,
    }));
  }

  return [
    {
      fromIcao: shipment.origen.codigo,
      toIcao: shipment.destino.codigo,
    },
  ];
};

export const buildRouteSegments = (
  route: BackendRuta | null | undefined,
  fallback?: { fromIcao: string; toIcao: string }
): ShipmentRouteSegment[] => {
  const flights = route?.vuelos ?? [];

  if (flights.length > 0) {
    return flights.map((flight) => ({
      fromIcao: flight.desde.codigo,
      toIcao: flight.hasta.codigo,
    }));
  }

  return fallback ? [fallback] : [];
};
