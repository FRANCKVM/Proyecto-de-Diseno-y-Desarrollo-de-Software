const EXPLICIT_ZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const pad2 = (value: number): string => String(value).padStart(2, "0");

export const normalizeUtcDateTime = (
  value: string | null | undefined
): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (EXPLICIT_ZONE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }

  return `${trimmed}Z`;
};

export const parseUtcDateTimeMs = (
  value: string | null | undefined
): number | null => {
  const normalized = normalizeUtcDateTime(value);
  if (!normalized) {
    return null;
  }

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

export const parseUtcDateTime = (
  value: string | null | undefined
): Date | null => {
  const ms = parseUtcDateTimeMs(value);
  return ms === null ? null : new Date(ms);
};

export const buildUtcDateTime = (
  fecha: string | null | undefined,
  hora: string | null | undefined
): Date | null => {
  if (!fecha || !hora) {
    return null;
  }

  return parseUtcDateTime(`${fecha}T${hora}${hora.length === 5 ? ":00" : ""}`);
};

export const formatUtcClock = (
  value: Date | number | string | null | undefined,
  fallback = "--:--:--"
): string => {
  const date = resolveDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(
    date.getUTCSeconds()
  )}`;
};

export const formatUtcDate = (
  value: Date | number | string | null | undefined,
  fallback = "--/--/----"
): string => {
  const date = resolveDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getUTCDate())}/${pad2(
    date.getUTCMonth() + 1
  )}/${date.getUTCFullYear()}`;
};

export const formatUtcDateTime = (
  value: Date | number | string | null | undefined,
  fallback = "--/--/---- --:--"
): string => {
  const date = resolveDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getUTCDate())}/${pad2(
    date.getUTCMonth() + 1
  )} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
};

export const formatUtcDateTimeWithYear = (
  value: Date | number | string | null | undefined,
  fallback = "--/--/---- --:--"
): string => {
  const date = resolveDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getUTCDate())}/${pad2(
    date.getUTCMonth() + 1
  )}/${date.getUTCFullYear()} ${pad2(date.getUTCHours())}:${pad2(
    date.getUTCMinutes()
  )}`;
};

export const formatUtcSimulationMinute = (
  minute: number | null | undefined,
  simulationStart?: string | null,
  fallback = "Sin hora"
): string => {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) {
    return fallback;
  }

  const simulationStartMs = parseUtcDateTimeMs(simulationStart);
  if (simulationStartMs !== null) {
    return formatUtcDateTime(simulationStartMs + minute * 60_000, fallback);
  }

  const normalized = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
};

export const addDaysToIsoDateUtc = (
  isoDate: string,
  days: number
): string | null => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const dateMs = Date.UTC(year, month - 1, day + days);
  const date = new Date(dateMs);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
};

const resolveDate = (
  value: Date | number | string | null | undefined
): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value) : null;
  }

  return parseUtcDateTime(value);
};
