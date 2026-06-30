import {
  fetchFlightsByAirportReferenceData,
  fetchFlightDetailReferenceData,
} from "@/services/referenceDataService";
import api from "@/services/api";
import {
  cacheFlightsForAirport,
  cacheFlightDetail,
  getCachedFlightByCode,
  getCachedFlightsByAirport,
  hasCachedFlightsByAirport,
  initializeReferenceData,
} from "@/store/referenceDataStore";
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
  codigo: string,
  idSimulacion?: number | null,
  options?: { forceRefresh?: boolean }
): Promise<VueloDetalle | null> => {
  if (idSimulacion != null) {
    const simulatedFlight = await fetchFlightDetailReferenceData(
      codigo,
      idSimulacion
    );

    if (simulatedFlight) {
      return simulatedFlight;
    }
  }

  const cachedFlight = options?.forceRefresh ? null : getCachedFlightByCode(codigo);
  if (cachedFlight) {
    return cachedFlight;
  }

  try {
    await initializeReferenceData();
  } catch {
    // Continuamos con fallback puntual por vuelo si la precarga falla.
  }

  const flight = await fetchFlightDetailReferenceData(codigo);
  if (flight) {
    cacheFlightDetail(flight);
  }
  return flight;
};

/**
 * Lista los vuelos conectados a un aeropuerto en el dia simulado actual.
 * Endpoint: GET /aeropuertos/{icao}/vuelos
 *
 * Para mock, devuelve el subconjunto de VUELOS_DETALLE_MOCK donde el
 * aeropuerto figura como origen o destino.
 */
export const listFlightsByAirport = async (
  icao: string,
  idSimulacion?: number | null,
  options?: { forceRefresh?: boolean }
): Promise<VueloDetalle[]> => {
  if (idSimulacion != null) {
    try {
      return await fetchFlightsByAirportReferenceData(icao, idSimulacion);
    } catch {
      // Fallback al dataset real si el contexto simulado no responde.
    }
  }

  if (!options?.forceRefresh && hasCachedFlightsByAirport(icao)) {
    return getCachedFlightsByAirport(icao);
  }

  try {
    await initializeReferenceData();
  } catch {
    // Si falla la precarga global, cargamos solo el aeropuerto solicitado.
  }

  if (!options?.forceRefresh && hasCachedFlightsByAirport(icao)) {
    return getCachedFlightsByAirport(icao);
  }

  const flights = await fetchFlightsByAirportReferenceData(icao);
  cacheFlightsForAirport(icao, flights);
  return flights;
};

export const cancelFlightByCode = async (
  codigo: string,
  fechaSalida: string,
  idSimulacion?: number | null
): Promise<VueloDetalle> => {
  const { data } = await api.post<VueloDetalle>(`/vuelos/${codigo}/cancelar`, {
    idSimulacion: idSimulacion ?? null,
    fechaSalida,
  });

  cacheFlightDetail(data);
  return data;
};
