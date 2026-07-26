import {
  formatUtcDateTime,
  formatUtcDateTimeWithYear,
  formatUtcSimulationMinute,
  pad2,
  parseUtcDateTimeMs,
} from "@/utils/utcDateTime";

const DAY_MINUTES = 24 * 60;

type DateTimeInput = Date | number | string | null | undefined;

const resolveLocalDate = (value: DateTimeInput): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value) : null;
  }

  const ms = parseUtcDateTimeMs(value);
  return ms === null ? null : new Date(ms);
};

export const formatOperationClock = (
  value: DateTimeInput,
  fallback = "--:--:--"
): string => {
  const date = resolveLocalDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
    date.getSeconds()
  )}`;
};

export const formatOperationDateTime = (
  value: DateTimeInput,
  fallback = "--/-- --:--"
): string => {
  const date = resolveLocalDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
};

export const formatOperationDateTimeWithYear = (
  value: DateTimeInput,
  fallback = "--/--/---- --:--"
): string => {
  const date = resolveLocalDate(value);
  if (!date) {
    return fallback;
  }

  return `${pad2(date.getDate())}/${pad2(
    date.getMonth() + 1
  )}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`;
};

export const getOperationMinuteOfDay = (value: DateTimeInput): number | null => {
  const date = resolveLocalDate(value);
  if (!date) {
    return null;
  }

  return date.getHours() * 60 + date.getMinutes();
};

export const getCurrentOperationMinuteOfDay = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const formatOperationMinuteOfDay = (
  minute: number | null | undefined,
  fallback = "Sin hora"
): string => {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) {
    return fallback;
  }

  const normalized = ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
};

export const formatContextDateTime = (
  value: DateTimeInput,
  idSimulacion?: number | null,
  fallback = "--/-- --:--"
): string => {
  return idSimulacion != null
    ? formatUtcDateTime(value, fallback)
    : formatOperationDateTime(value, fallback);
};

export const formatContextDateTimeWithYear = (
  value: DateTimeInput,
  idSimulacion?: number | null,
  fallback = "--/--/---- --:--"
): string => {
  return idSimulacion != null
    ? formatUtcDateTimeWithYear(value, fallback)
    : formatOperationDateTimeWithYear(value, fallback);
};

export const formatContextSimulationMinute = (
  minute: number | null | undefined,
  simulationStart: string | null | undefined,
  idSimulacion?: number | null,
  fallback = "Sin hora"
): string => {
  return idSimulacion != null
    ? formatUtcSimulationMinute(minute, simulationStart, fallback)
    : formatOperationMinuteOfDay(minute, fallback);
};
