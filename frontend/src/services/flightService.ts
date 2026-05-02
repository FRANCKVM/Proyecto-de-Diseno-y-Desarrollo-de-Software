import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import { VUELOS_DETALLE_MOCK } from "@/services/sources2.0/flightsDetail.mock";
import { USE_MOCK_DATA } from "@/utils/constants";
import type { VueloDetalle } from "@/types/flight.types";

/**
 * Servicio de vuelos.
 *
 * Si USE_MOCK_DATA=true, devuelve datos del mock. Si es false,
 * ataca el backend.
 *
 * Solo expone el shape `VueloDetalle` (entidad de negocio). El shape
 * para animacion visual (`AnimatedFlight`) se mantiene aparte porque
 * vive en el motor de simulacion del cliente, no en el backend.
 */

/**
 * Obtiene el detalle de un vuelo por su codigo.
 * Endpoint: GET /vuelos/{codigo}
 */
export const getFlightByCode = async (
  codigo: string
): Promise<VueloDetalle | null> => {
  if (USE_MOCK_DATA) {
    const found = VUELOS_DETALLE_MOCK.find((v) => v.codigo === codigo);
    return mockResolve<VueloDetalle | null>(found ?? null);
  }
  try {
    const { data } = await api.get<VueloDetalle>(`/vuelos/${codigo}`);
    return data;
  } catch {
    return null;
  }
};

/**
 * Lista los vuelos conectados a un aeropuerto en el dia simulado actual.
 * Endpoint: GET /aeropuertos/{icao}/vuelos
 *
 * Para mock, devuelve el subconjunto de VUELOS_DETALLE_MOCK donde el
 * aeropuerto figura como origen o destino.
 */
export const listFlightsByAirport = async (
  icao: string
): Promise<VueloDetalle[]> => {
  if (USE_MOCK_DATA) {
    const filtered = VUELOS_DETALLE_MOCK.filter(
      (v) => v.origenIcao === icao || v.destinoIcao === icao
    );
    return mockResolve<VueloDetalle[]>(filtered);
  }
  const { data } = await api.get<VueloDetalle[]>(`/aeropuertos/${icao}/vuelos`);
  return data;
};
