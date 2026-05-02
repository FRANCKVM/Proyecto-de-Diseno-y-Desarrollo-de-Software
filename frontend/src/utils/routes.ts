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
