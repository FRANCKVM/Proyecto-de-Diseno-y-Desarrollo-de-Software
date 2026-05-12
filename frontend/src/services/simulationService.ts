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
import type {
  BackendEstadoSimulacion,
  BackendMapaSimulacionEstado,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";
import axios from "axios";

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

/**
 * Inicia una simulacion de backend.
 * Endpoint: POST /simulacion/iniciar
 */
export const startLiveSimulation = async (
  params: {
    k: number;
    fechaInicio: string;
    horaInicio: string;
    duracionDias: number | null;
  }
): Promise<BackendEstadoSimulacion | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendEstadoSimulacion | null>(null);
  }

  try {
    const { data } = await api.post<BackendEstadoSimulacion>(
      "/simulacion/iniciar",
      params
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const backendMessage =
        typeof error.response?.data === "string"
          ? error.response.data
          : null;

      throw new Error(
        backendMessage ?? "No se pudo iniciar la simulacion en backend."
      );
    }

    throw new Error("No se pudo iniciar la simulacion en backend.");
  }
};

/**
 * Obtiene el estado global de la simulacion activa.
 * Endpoint: GET /simulacion/estado
 */
export const getCurrentLiveSimulationState = async (): Promise<BackendEstadoSimulacion | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendEstadoSimulacion | null>(null);
  }

  try {
    const { data } = await api.get<BackendEstadoSimulacion>("/simulacion/estado");
    return data;
  } catch {
    return null;
  }
};

/**
 * Obtiene el estado de una simulacion.
 * Endpoint: GET /simulacion/{id}/estado
 */
export const getLiveSimulationState = async (
  idSimulacion: number
): Promise<BackendEstadoSimulacion | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendEstadoSimulacion | null>(null);
  }

  try {
    const { data } = await api.get<BackendEstadoSimulacion>(
      `/simulacion/${idSimulacion}/estado`
    );
    return data;
  } catch {
    return null;
  }
};

/**
 * Lista los envios persistidos de una simulacion.
 * Endpoint: GET /simulacion/{id}/envios
 */
export const listLiveSimulationShipments = async (
  idSimulacion: number
): Promise<BackendSolicitudEnvio[]> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendSolicitudEnvio[]>([]);
  }

  const { data } = await api.get<BackendSolicitudEnvio[]>(
    `/simulacion/${idSimulacion}/envios`
  );
  return data;
};

/**
 * Obtiene el estado del mapa de una simulacion.
 * Endpoint: GET /simulacion/{id}/mapa
 */
export const getLiveSimulationMap = async (
  idSimulacion: number
): Promise<BackendMapaSimulacionEstado | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendMapaSimulacionEstado | null>(null);
  }

  try {
    const { data } = await api.get<BackendMapaSimulacionEstado>(
      `/simulacion/${idSimulacion}/mapa`
    );
    return data;
  } catch {
    return null;
  }
};

/**
 * Detiene una simulacion activa.
 * Endpoint: POST /simulacion/detener
 */
export const stopLiveSimulation = async (): Promise<boolean> => {
  if (USE_MOCK_DATA) {
    return mockResolve<boolean>(true);
  }

  try {
    await api.post("/simulacion/detener");
    return true;
  } catch {
    return false;
  }
};
