import type { MapFlight } from "@/components/map/WorldMap";
import type {
  BackendMapaVuelo,
  BackendSolicitudEnvio,
  BackendVuelo,
} from "@/types/backendSimulation.types";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";

interface EmptyMapFlightOptions {
  shipments?: BackendSolicitudEnvio[];
  referenceMinute?: number | null;
  simulationStart?: string | null;
  nowMs?: number;
  simMinutesPerSecond?: number | null;
  allowBackendProgressFallback?: boolean;
}

interface FlightWindowMatch {
  progress: number;
  departureMinute?: number;
  arrivalMinute?: number;
  durationMinutes?: number;
}

interface FlightWindowIndex {
  activeByCodeRoute: Map<string, FlightWindowMatch>;
  activeByRoute: Map<string, FlightWindowMatch>;
  knownCodeRoutes: Set<string>;
  knownRoutes: Set<string>;
}

const FLIGHT_CODE_PATTERN = /(?:vuelo|flight)-(\d+)/i;
const DAY_MINUTES = 24 * 60;

const clampProgress = (value: number): number =>
  Math.max(0, Math.min(1, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getProgressTimestamp = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

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

const getUtcMinutesSinceShipmentDay = (
  shipment: BackendSolicitudEnvio,
  nowMs: number
): number | null => {
  const shipmentDayMs = Date.parse(`${shipment.fecha}T00:00:00Z`);

  if (Number.isNaN(shipmentDayMs)) {
    return null;
  }

  return Math.floor((nowMs - shipmentDayMs) / 60_000);
};

const getShipmentStartMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStartMs: number | null
): number => {
  if (simulationStartMs === null) {
    return parseShipmentUtcMinute(shipment);
  }

  const shipmentMs = parseLocalDateTimeMs(`${shipment.fecha}T${shipment.hora}`);
  if (shipmentMs === null) {
    return parseShipmentUtcMinute(shipment);
  }

  return Math.max(0, Math.floor((shipmentMs - simulationStartMs) / 60_000));
};

const getReferenceMinute = (
  shipment: BackendSolicitudEnvio,
  referenceMinute: number | null | undefined,
  simulationStartMs: number | null,
  nowMs: number
): number | null => {
  if (referenceMinute !== null && referenceMinute !== undefined) {
    return referenceMinute;
  }

  if (simulationStartMs !== null) {
    return 0;
  }

  return getUtcMinutesSinceShipmentDay(shipment, nowMs);
};

const getNextFlightWindow = (
  earliestMinute: number,
  flight: BackendVuelo
): { departure: number; arrival: number; durationMinutes: number } => {
  const departureBase = normalizeMinute(flight.salidaUtcMin ?? 0);
  let arrivalBase = flight.llegadaUtcMin ?? departureBase;

  while (arrivalBase <= departureBase) {
    arrivalBase += DAY_MINUTES;
  }

  const durationMinutes = Math.max(1, arrivalBase - departureBase);
  const occurrenceOffset = Math.max(
    0,
    Math.ceil((earliestMinute - departureBase) / DAY_MINUTES)
  );
  const departure = departureBase + occurrenceOffset * DAY_MINUTES;

  return {
    departure,
    arrival: departure + durationMinutes,
    durationMinutes,
  };
};

const getFlightKey = (flight: MapFlight): string => flight.code ?? flight.id;

const getRouteKey = (fromIcao: string, toIcao: string): string =>
  `${fromIcao}:${toIcao}`;

const getCodeRouteKey = (
  code: string,
  fromIcao: string,
  toIcao: string
): string => `${code}:${getRouteKey(fromIcao, toIcao)}`;

const getFlightIdentityKeys = (flight: MapFlight): string[] => {
  const keys = [`id:${flight.id}`];

  if (flight.code) {
    keys.push(`code:${flight.code}`);
    keys.push(`route:${flight.code}:${flight.fromIcao}:${flight.toIcao}`);
  }

  return keys;
};

export const getBackendMapFlightCode = (id: string): string | undefined => {
  const match = id.match(FLIGHT_CODE_PATTERN);
  return match?.[1];
};

const getBackendFlightCode = (flight: BackendMapaVuelo): string | undefined =>
  flight.code?.trim() || getBackendMapFlightCode(flight.id);

const hasAuthoritativeBackendFlightData = (
  flight: BackendMapaVuelo
): boolean =>
  flight.occupancyPct != null ||
  flight.departureMinute != null ||
  flight.arrivalMinute != null ||
  flight.durationMinutes != null;

const resolveAuthoritativeBackendFlight = (
  flight: BackendMapaVuelo
): FlightWindowMatch | null => {
  if (!hasAuthoritativeBackendFlightData(flight)) {
    return null;
  }

  const backendProgress = clampProgress(flight.progress);
  if (backendProgress <= 0 || backendProgress >= 1) {
    return null;
  }

  const departureMinute = isFiniteNumber(flight.departureMinute)
    ? flight.departureMinute
    : undefined;
  const arrivalMinute = isFiniteNumber(flight.arrivalMinute)
    ? flight.arrivalMinute
    : undefined;
  const durationMinutes = isFiniteNumber(flight.durationMinutes)
    ? flight.durationMinutes
    : departureMinute !== undefined && arrivalMinute !== undefined
      ? Math.max(1, arrivalMinute - departureMinute)
      : undefined;

  return {
    progress: backendProgress,
    departureMinute,
    arrivalMinute,
    durationMinutes,
  };
};

const createEmptyFlightWindowIndex = (): FlightWindowIndex => ({
  activeByCodeRoute: new Map(),
  activeByRoute: new Map(),
  knownCodeRoutes: new Set(),
  knownRoutes: new Set(),
});

const buildFlightWindowIndex = (
  options: EmptyMapFlightOptions
): FlightWindowIndex => {
  const shipments = options.shipments ?? [];
  const simulationStartMs = parseLocalDateTimeMs(options.simulationStart);
  const nowMs = options.nowMs ?? Date.now();
  const index = createEmptyFlightWindowIndex();

  for (const shipment of shipments) {
    const reference = getReferenceMinute(
      shipment,
      options.referenceMinute,
      simulationStartMs,
      nowMs
    );

    if (reference === null) {
      continue;
    }

    for (const group of getShipmentRouteGroups(shipment)) {
      let earliestDeparture = getShipmentStartMinute(
        shipment,
        simulationStartMs
      );

      for (const routeFlight of group.ruta?.vuelos ?? []) {
        const { departure, arrival, durationMinutes } = getNextFlightWindow(
          earliestDeparture,
          routeFlight
        );
        earliestDeparture = arrival;
        const code = String(routeFlight.idVuelo);
        const fromIcao = routeFlight.desde.codigo;
        const toIcao = routeFlight.hasta.codigo;
        const routeKey = getRouteKey(fromIcao, toIcao);
        const codeRouteKey = getCodeRouteKey(code, fromIcao, toIcao);

        index.knownRoutes.add(routeKey);
        index.knownCodeRoutes.add(codeRouteKey);

        if (reference < departure || reference >= arrival) {
          continue;
        }

        const match = {
          progress: clampProgress((reference - departure) / durationMinutes),
          departureMinute: departure,
          arrivalMinute: arrival,
          durationMinutes,
        };

        if (!index.activeByCodeRoute.has(codeRouteKey)) {
          index.activeByCodeRoute.set(codeRouteKey, match);
        }

        if (!index.activeByRoute.has(routeKey)) {
          index.activeByRoute.set(routeKey, match);
        }
      }
    }
  }

  return index;
};

const resolveEmptyFlightProgress = (
  backendFlight: BackendMapaVuelo,
  backendCode: string | undefined,
  options: EmptyMapFlightOptions,
  index: FlightWindowIndex
): FlightWindowMatch | null => {
  const routeKey = getRouteKey(backendFlight.fromIcao, backendFlight.toIcao);
  const codeRouteKey =
    backendCode !== undefined
      ? getCodeRouteKey(backendCode, backendFlight.fromIcao, backendFlight.toIcao)
      : null;
  const match =
    codeRouteKey !== null
      ? index.activeByCodeRoute.get(codeRouteKey)
      : index.activeByRoute.get(routeKey);

  if (match) {
    return match;
  }

  // Si conocemos la definicion horaria y no esta activa, no la dibujamos
  // estacionada en el aeropuerto. El mapa debe mostrar vuelos en aire.
  const sawMatchingDefinition =
    codeRouteKey !== null
      ? index.knownCodeRoutes.has(codeRouteKey)
      : index.knownRoutes.has(routeKey);

  if (sawMatchingDefinition) {
    return null;
  }

  if (options.allowBackendProgressFallback === false) {
    return null;
  }

  const backendProgress = clampProgress(backendFlight.progress);

  if (backendProgress <= 0 || backendProgress >= 1) {
    return null;
  }

  return { progress: backendProgress };
};

const getEmptyFlightDedupeKey = (
  flight: BackendMapaVuelo,
  code: string | undefined,
  resolved: FlightWindowMatch
): string => {
  if (!code) {
    return `id:${flight.id}`;
  }

  const occurrence =
    resolved.departureMinute !== undefined
      ? resolved.departureMinute
      : `progress-${Math.round(clampProgress(flight.progress) * 1000)}`;

  return `code-route:${code}:${flight.fromIcao}:${flight.toIcao}:${occurrence}`;
};

export const buildEmptyMapFlights = (
  backendFlights: BackendMapaVuelo[] = [],
  options: EmptyMapFlightOptions = {}
): MapFlight[] => {
  const needsShipmentIndex =
    (options.shipments?.length ?? 0) > 0 &&
    backendFlights.some((flight) => !hasAuthoritativeBackendFlightData(flight));
  const index = needsShipmentIndex
    ? buildFlightWindowIndex(options)
    : createEmptyFlightWindowIndex();
  const seenFlights = new Set<string>();

  return backendFlights.flatMap((flight) => {
    const code = getBackendFlightCode(flight);
    const resolved =
      resolveAuthoritativeBackendFlight(flight) ??
      resolveEmptyFlightProgress(flight, code, options, index);

    if (!resolved) {
      return [];
    }

    const dedupeKey = getEmptyFlightDedupeKey(flight, code, resolved);
    if (seenFlights.has(dedupeKey)) {
      return [];
    }
    seenFlights.add(dedupeKey);

    const simMinutesPerSecond = options.simMinutesPerSecond ?? 1 / 60;

    return [
      {
        id: flight.id,
        code,
        fromIcao: flight.fromIcao,
        toIcao: flight.toIcao,
        progress: resolved.progress,
        occupancyPct: isFiniteNumber(flight.occupancyPct)
          ? flight.occupancyPct
          : 0,
        departureMinute: resolved.departureMinute,
        arrivalMinute: resolved.arrivalMinute,
        durationSeconds:
          resolved.durationMinutes !== undefined
            ? resolved.durationMinutes * 60
            : undefined,
        progressVelocityPerSecond:
          resolved.durationMinutes !== undefined
            ? simMinutesPerSecond / resolved.durationMinutes
            : undefined,
        progressUpdatedAtMs:
          resolved.durationMinutes !== undefined ? getProgressTimestamp() : undefined,
      },
    ];
  });
};

export const mergeMapFlights = (
  primaryFlights: MapFlight[],
  fallbackFlights: MapFlight[]
): MapFlight[] => {
  const primaryKeys = new Set(primaryFlights.flatMap(getFlightIdentityKeys));

  const uniqueFallbackFlights = fallbackFlights.filter((flight) => {
    const key = getFlightKey(flight);
    const identityKeys = getFlightIdentityKeys(flight);

    return (
      !primaryKeys.has(`id:${flight.id}`) &&
      !primaryKeys.has(`code:${key}`) &&
      identityKeys.every((identityKey) => !primaryKeys.has(identityKey))
    );
  });

  return [...primaryFlights, ...uniqueFallbackFlights];
};
