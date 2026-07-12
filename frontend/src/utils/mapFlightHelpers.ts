import type { MapFlight } from "@/components/map/WorldMap";
import type { BackendMapaVuelo } from "@/types/backendSimulation.types";

interface MapFlightOptions {
  simMinutesPerSecond?: number | null;
  referenceMinute?: number | null;
  allowBackendProgressFallback?: boolean;
}

const FLIGHT_CODE_PATTERN = /(?:vuelo|flight)-(\d+)/i;
const clampProgress = (value: number): number => Math.max(0, Math.min(1, value));
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const getBackendMapFlightCode = (id: string): string | undefined =>
  id.match(FLIGHT_CODE_PATTERN)?.[1];

export const buildEmptyMapFlights = (
  backendFlights: BackendMapaVuelo[] = [],
  options: MapFlightOptions = {}
): MapFlight[] => {
  const simMinutesPerSecond = options.simMinutesPerSecond ?? 1 / 60;
  const referenceMinute = options.referenceMinute;
  const allowBackendProgressFallback =
    options.allowBackendProgressFallback ?? true;
  const seenOccurrences = new Set<string>();
  return backendFlights.flatMap((flight) => {
    const departureMinute = isFiniteNumber(flight.departureMinute) ? flight.departureMinute : undefined;
    const arrivalMinute = isFiniteNumber(flight.arrivalMinute) ? flight.arrivalMinute : undefined;
    const durationMinutes = isFiniteNumber(flight.durationMinutes)
      ? flight.durationMinutes
      : departureMinute !== undefined && arrivalMinute !== undefined
        ? Math.max(1, arrivalMinute - departureMinute)
        : undefined;
    const canCalculateLocalProgress =
      isFiniteNumber(referenceMinute) &&
      departureMinute !== undefined &&
      durationMinutes !== undefined &&
      durationMinutes > 0;
    const progress = canCalculateLocalProgress
      ? clampProgress((referenceMinute - departureMinute) / durationMinutes)
      : allowBackendProgressFallback
        ? clampProgress(flight.progress)
        : null;

    if (
      progress === null ||
      progress <= 0 ||
      progress >= 1 ||
      seenOccurrences.has(flight.id)
    ) return [];
    seenOccurrences.add(flight.id);

    return [{
      id: flight.id,
      code: flight.code?.trim() || getBackendMapFlightCode(flight.id),
      fromIcao: flight.fromIcao,
      toIcao: flight.toIcao,
      progress,
      occupancyPct: isFiniteNumber(flight.occupancyPct) ? flight.occupancyPct : 0,
      departureMinute,
      arrivalMinute,
      durationSeconds: durationMinutes !== undefined ? durationMinutes * 60 : undefined,
      progressVelocityPerSecond: durationMinutes !== undefined ? simMinutesPerSecond / durationMinutes : undefined,
      progressUpdatedAtMs: durationMinutes !== undefined
        ? (typeof performance !== "undefined" ? performance.now() : Date.now())
        : undefined,
    }];
  });
};

export const mergeMapFlights = (primaryFlights: MapFlight[], fallbackFlights: MapFlight[]): MapFlight[] => {
  const ids = new Set(primaryFlights.map((flight) => flight.id));
  return [...primaryFlights, ...fallbackFlights.filter((flight) => !ids.has(flight.id))];
};
