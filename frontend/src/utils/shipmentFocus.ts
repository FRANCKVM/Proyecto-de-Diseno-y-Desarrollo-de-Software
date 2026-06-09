import type { BackendSolicitudEnvio, BackendVuelo } from "@/types/backendSimulation.types";

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
  referenceMinute?: number | null
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
  if (routeFlights.length === 0) {
    return {
      focusedAirportIcao: shipment.origen.codigo,
      focusedFlightId: null,
    };
  }

  const reference = referenceMinute ?? getCurrentUtcMinute();
  let previousAirportIcao = shipment.origen.codigo;
  let earliestMinute = 0;

  for (const flight of routeFlights) {
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
  const routeFlights = shipment.ruta?.vuelos ?? [];

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
