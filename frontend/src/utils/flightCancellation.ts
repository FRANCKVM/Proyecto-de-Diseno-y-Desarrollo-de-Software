const MIN_CANCEL_NOTICE_MINUTES = 60;
const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;
const DAY_MS = DAY_MINUTES * MINUTE_MS;

const ZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

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
  const normalized = value.trim();

  if (hasExplicitZone(normalized)) {
    return Date.parse(normalized);
  }

  const match = LOCAL_DATE_TIME_PATTERN.exec(normalized);
  if (!match) {
    return Date.parse(normalized);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime();
};

const formatLocalDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const formatDateLikeInput = (dateMs: number, input: string): string => {
  const date = new Date(dateMs);
  return hasExplicitZone(input) ? date.toISOString() : formatLocalDateTime(date);
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
      ? "El vuelo ya esta dentro de la ultima hora antes del despegue. Se programo la cancelacion para la ocurrencia del dia siguiente."
      : null,
  };
};
