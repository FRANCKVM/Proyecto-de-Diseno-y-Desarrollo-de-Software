import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import {
  HOME_KPIS_MOCK,
  ACTIVIDAD_RECIENTE_MOCK,
  type HomeKpis,
} from "@/services/sources2.0/homeData.mock";
import { USE_MOCK_DATA } from "@/utils/constants";
import type { ActividadReciente } from "@/types/activity.types";

export type { HomeKpis };

/**
 * Servicio del Home.
 * Provee los KPIs principales y el feed de actividad reciente.
 */

/**
 * Obtiene los 4 KPIs del Home (aeropuertos, vuelos, envios, cumplimiento).
 * Endpoint: GET /home/kpis
 */
export const getHomeKpis = async (): Promise<HomeKpis> => {
  if (USE_MOCK_DATA) return mockResolve<HomeKpis>(HOME_KPIS_MOCK);
  const { data } = await api.get<HomeKpis>("/home/kpis");
  return data;
};

/**
 * Lista los items recientes del feed de actividad.
 * Endpoint: GET /home/actividad-reciente
 *
 * Devuelve los N items mas recientes ordenados de mas nuevo a mas antiguo.
 */
export const listRecentActivity = async (): Promise<ActividadReciente[]> => {
  if (USE_MOCK_DATA)
    return mockResolve<ActividadReciente[]>(ACTIVIDAD_RECIENTE_MOCK);
  const { data } = await api.get<ActividadReciente[]>(
    "/home/actividad-reciente"
  );
  return data;
};
