import type { BackendEstadoSimulacion } from "@/types/backendSimulation.types";
import {
  buildUtcDateTime,
  formatUtcClock,
  formatUtcDate,
  formatUtcDateTimeWithYear,
  parseUtcDateTime,
} from "@/utils/utcDateTime";

export const parseUtcSimulationDateTime = (
  value: string | null | undefined
): Date | null => {
  return parseUtcDateTime(value);
};

export const parseBackendRealDateTime = (
  value: string | null | undefined,
  _nowMs: number
): Date | null => {
  if (!value) {
    return null;
  }

  return parseUtcDateTime(value);
};

export const buildUtcSimulationDateTime = (
  fecha: string | null | undefined,
  hora: string | null | undefined
): Date | null => {
  if (!fecha || !hora) {
    return null;
  }

  return buildUtcDateTime(fecha, hora);
};

export const formatClock = (date: Date | null): string =>
  formatUtcClock(date);

export const formatStartDateTime = (date: Date | null): string =>
  formatUtcDateTimeWithYear(date);

export const formatDate = (date: Date | null): string =>
  formatUtcDate(date);

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
    ? buildUtcSimulationDateTime(fechaInicio, horaInicio)
    : parseUtcSimulationDateTime(estado?.fechaHoraInicioSimulacion) ??
      buildUtcSimulationDateTime(fechaInicio, horaInicio);

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
