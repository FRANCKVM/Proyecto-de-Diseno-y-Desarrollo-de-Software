import { parseUtcDateTimeMs, pad2 } from "@/utils/utcDateTime";

const MIN_CANCEL_NOTICE_MINUTES = 60;
const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;
const DAY_MS = DAY_MINUTES * MINUTE_MS;

const ZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;
interface ResolveFlightCancellationInput {
  fechaSalida: string;
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  departureMinute?: number;
  simulationStart?: string | null;
}

export interface ResolvedFlightCancellation {
  fechaSalida: string;
  shiftedToNextDay: boolean;
  notice: string | null;
}

const hasExplicitZone = (value: string): boolean =>
  ZONE_SUFFIX_PATTERN.test(value.trim());

const parseDateTimeMs = (value: string): number => {
  return parseUtcDateTimeMs(value) ?? NaN;
};

const formatUtcDateTimeWithoutZone = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());
  const minute = pad2(date.getUTCMinutes());
  const second = pad2(date.getUTCSeconds());

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const formatDateLikeInput = (dateMs: number, input: string): string => {
  const date = new Date(dateMs);
  return hasExplicitZone(input) ? date.toISOString() : formatUtcDateTimeWithoutZone(date);
};

export const resolveFlightCancellationTiming = ({
  fechaSalida,
  idSimulacion,
  referenceMinute,
  departureMinute,
  simulationStart,
}: ResolveFlightCancellationInput): ResolvedFlightCancellation => {
  const departureMs = parseDateTimeMs(fechaSalida);

  if (!Number.isFinite(departureMs)) {
    return {
      fechaSalida,
      shiftedToNextDay: false,
      notice: null,
    };
  }

  let shiftedToNextDay = false;
  let effectiveDepartureMs = departureMs;

  const simulationStartMs = simulationStart ? parseDateTimeMs(simulationStart) : NaN;
  const simulatedDepartureMinute =
    departureMinute ??
    (Number.isFinite(simulationStartMs)
      ? Math.round((departureMs - simulationStartMs) / MINUTE_MS)
      : undefined);

  if (
    idSimulacion != null &&
    referenceMinute !== null &&
    referenceMinute !== undefined &&
    simulatedDepartureMinute !== undefined
  ) {
    let effectiveDepartureMinute = simulatedDepartureMinute;
    while (effectiveDepartureMinute - referenceMinute < MIN_CANCEL_NOTICE_MINUTES) {
      effectiveDepartureMinute += DAY_MINUTES;
      shiftedToNextDay = true;
    }

    effectiveDepartureMs +=
      (effectiveDepartureMinute - simulatedDepartureMinute) * MINUTE_MS;
  } else {
    const minimumDepartureMs = Date.now() + MIN_CANCEL_NOTICE_MINUTES * MINUTE_MS;
    while (effectiveDepartureMs < minimumDepartureMs) {
      effectiveDepartureMs += DAY_MS;
      shiftedToNextDay = true;
    }
  }

  return {
    fechaSalida: formatDateLikeInput(effectiveDepartureMs, fechaSalida),
    shiftedToNextDay,
    notice: shiftedToNextDay
      ? "El vuelo actual ya salio o esta dentro de la ultima hora antes del despegue. Se cancelo la siguiente ocurrencia."
      : null,
  };
};
