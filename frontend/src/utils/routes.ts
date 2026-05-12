import type { TipoSimulacion } from "@/types/common.types";

/**
 * Rutas del sistema Tasf.B2B.
 * Usar siempre estas constantes en lugar de strings hardcoded
 * para evitar typos y facilitar refactors.
 */
export const ROUTES = {
  HOME: "/",
  ENVIOS_OPERACION: "/envios/operacion",
  SIMULACION_CONFIGURAR: "/simulacion/configurar",
  SIMULACION_EJECUCION: "/simulacion/ejecucion",
  SIMULACION_COLAPSO: "/simulacion/colapso",
  SIMULACION_RESULTADOS: (id: string | number) =>
    `/simulacion/resultados/${id}`,
  SIMULACION_RESULTADOS_COLAPSO: (id: string | number) =>
    `/simulacion/resultados-colapso/${id}`,
  DASHBOARD: "/dashboard",
} as const;

export const resolveSimulationExecutionRoute = (
  tipoSimulacion: TipoSimulacion | null | undefined
) =>
  tipoSimulacion === "colapso"
    ? ROUTES.SIMULACION_COLAPSO
    : ROUTES.SIMULACION_EJECUCION;

export const resolveSimulationResultsRoute = (
  tipoSimulacion: TipoSimulacion | null | undefined,
  idSimulacion: string | number
) =>
  tipoSimulacion === "colapso"
    ? ROUTES.SIMULACION_RESULTADOS_COLAPSO(idSimulacion)
    : ROUTES.SIMULACION_RESULTADOS(idSimulacion);

export const resolveSimulationModuleRoute = ({
  idSimulacion,
  isRunning,
  tipoSimulacion,
}: {
  idSimulacion: number | null;
  isRunning: boolean;
  tipoSimulacion: TipoSimulacion | null | undefined;
}) => {
  if (idSimulacion === null) {
    return ROUTES.SIMULACION_CONFIGURAR;
  }

  if (isRunning) {
    return resolveSimulationExecutionRoute(tipoSimulacion);
  }

  return resolveSimulationResultsRoute(tipoSimulacion, idSimulacion);
};
