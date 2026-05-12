import {
  fetchFlightsByAirportReferenceData,
} from "@/services/referenceDataService";
import {
  cacheFlightsForAirport,
  ensureFlightDetailCached,
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
  codigo: string
): Promise<VueloDetalle | null> => {
  const cachedFlight = getCachedFlightByCode(codigo);
  if (cachedFlight) {
    return cachedFlight;
  }

  try {
    await initializeReferenceData();
  } catch {
    // Continuamos con fallback puntual por vuelo si la precarga falla.
  }

  return ensureFlightDetailCached(codigo);
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
  if (hasCachedFlightsByAirport(icao)) {
    return getCachedFlightsByAirport(icao);
  }

  try {
    await initializeReferenceData();
  } catch {
    // Si falla la precarga global, cargamos solo el aeropuerto solicitado.
  }

  if (hasCachedFlightsByAirport(icao)) {
    return getCachedFlightsByAirport(icao);
  }

  const flights = await fetchFlightsByAirportReferenceData(icao);
  cacheFlightsForAirport(icao, flights);
  return flights;
};
