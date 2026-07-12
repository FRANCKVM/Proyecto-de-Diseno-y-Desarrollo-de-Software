import type { BackendEstadoSimulacion } from "@/types/backendSimulation.types";

const CLOCK_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const START_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const parseLocalDateTime = (
  value: string | null | undefined
): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseBackendRealDateTime = (
  value: string | null | undefined,
  nowMs: number
): Date | null => {
  if (!value) {
    return null;
  }

  const localDate = parseLocalDateTime(value);
  const utcDate = parseLocalDateTime(`${value.replace(/Z$/, "")}Z`);

  if (!localDate) {
    return utcDate;
  }

  if (!utcDate) {
    return localDate;
  }

  const localDrift = Math.abs(nowMs - localDate.getTime());
  const utcDrift = Math.abs(nowMs - utcDate.getTime());

  return utcDrift < localDrift ? utcDate : localDate;
};

export const buildLocalDateTime = (
  fecha: string | null | undefined,
  hora: string | null | undefined
): Date | null => {
  if (!fecha || !hora) {
    return null;
  }

  return parseLocalDateTime(`${fecha}T${hora}:00`);
};

export const formatClock = (date: Date | null): string =>
  date ? CLOCK_FORMATTER.format(date) : "--:--:--";

export const formatStartDateTime = (date: Date | null): string =>
  date ? START_FORMATTER.format(date) : "--/--/---- --:--";

export const formatDate = (date: Date | null): string =>
  date ? DATE_FORMATTER.format(date) : "--/--/----";

export const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${hh}:${mm}:${ss}`;
  }

  return `${hh}:${mm}:${ss}`;
};

interface ResolveSimulationClockDataParams {
  estado: BackendEstadoSimulacion | null;
  fechaInicio: string | null | undefined;
  horaInicio: string | null | undefined;
  nowMs: number;
  useMockData: boolean;
  backendBlockIntervalMs: number;
}

export const resolveSimulationClockData = ({
  estado,
  fechaInicio,
  horaInicio,
  nowMs,
  useMockData,
  backendBlockIntervalMs,
}: ResolveSimulationClockDataParams) => {
  const fechaInicioReal = useMockData
    ? null
    : parseBackendRealDateTime(estado?.fechaHoraInicioReal, nowMs);
  const fechaInicioSimulacion = useMockData
    ? buildLocalDateTime(fechaInicio, horaInicio)
    : parseLocalDateTime(estado?.fechaHoraInicioSimulacion) ??
      buildLocalDateTime(fechaInicio, horaInicio);

  const elapsedRealMs = fechaInicioReal
    ? Math.max(0, nowMs - fechaInicioReal.getTime())
    : 0;

  const simulatedMsPerRealMs =
    !useMockData &&
    estado?.scMinutos &&
    backendBlockIntervalMs > 0
      ? (estado.scMinutos * 60_000) / backendBlockIntervalMs
      : 0;

  const elapsedSimulatedMs =
    simulatedMsPerRealMs > 0
      ? elapsedRealMs * simulatedMsPerRealMs
      : Math.max(0, (estado?.punteroConsumoMinutos ?? 0) * 60_000);

  const fechaActualSimulacion = fechaInicioSimulacion
    ? new Date(fechaInicioSimulacion.getTime() + elapsedSimulatedMs)
    : null;
  const horaActual = formatClock(new Date(nowMs));
  const fechaHoraActual = formatStartDateTime(new Date(nowMs));
  const horaSimulacion = formatClock(fechaActualSimulacion);

  return {
    elapsedRealMs,
    elapsedSimulatedMs,
    inicioSimulacion: formatStartDateTime(fechaInicioSimulacion),
    fechaHoraActual,
    fechaSimulacionActual: formatDate(fechaActualSimulacion),
    horaActual,
    horaSimulacion,
  };
};
