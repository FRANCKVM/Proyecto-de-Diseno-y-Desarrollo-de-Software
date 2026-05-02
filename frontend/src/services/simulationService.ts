import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import {
  RESULTADO_PERIODO_MOCK,
  RESULTADO_COLAPSO_MOCK,
} from "@/services/sources2.0/simulationResults.mock";
import { USE_MOCK_DATA } from "@/utils/constants";
import type {
  ResultadoPeriodo,
  ResultadoColapso,
} from "@/types/simulationResult.types";

/**
 * Servicio de resultados de simulacion.
 *
 * Si USE_MOCK_DATA=true, devuelve datos de sources2.0/simulationResults.mock.
 * Si es false, ataca el backend.
 *
 * Los IDs no se filtran en mock (siempre devuelve el mismo dataset)
 * porque la entidad simulacion-corrida todavia no tiene persistencia
 * en el cliente. Cuando el backend devuelva resultados reales, ese
 * ID se utiliza para fetch del recurso correspondiente.
 */

/**
 * Obtiene el resultado de una simulacion de periodo.
 * Endpoint: GET /simulaciones/periodo/{id}
 */
export const getPeriodResult = async (
  id: string
): Promise<ResultadoPeriodo | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<ResultadoPeriodo | null>({
      ...RESULTADO_PERIODO_MOCK,
      id,
    });
  }
  try {
    const { data } = await api.get<ResultadoPeriodo>(
      `/simulaciones/periodo/${id}`
    );
    return data;
  } catch {
    return null;
  }
};

/**
 * Obtiene el resultado de una simulacion al colapso.
 * Endpoint: GET /simulaciones/colapso/{id}
 */
export const getCollapseResult = async (
  id: string
): Promise<ResultadoColapso | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<ResultadoColapso | null>({
      ...RESULTADO_COLAPSO_MOCK,
      id,
    });
  }
  try {
    const { data } = await api.get<ResultadoColapso>(
      `/simulaciones/colapso/${id}`
    );
    return data;
  } catch {
    return null;
  }
};
