import { fetchAllAirportsReferenceData } from "@/services/referenceDataService";
import {
  getCachedAirportByIcao,
  getCachedAirports,
  initializeReferenceData,
  useReferenceDataStore,
} from "@/store/referenceDataStore";
import type { AirportWithCoords } from "@/types/airport.types";

/**
 * Servicio de aeropuertos.
 *
 * Si USE_MOCK_DATA=true (entorno de desarrollo sin backend), las
 * funciones devuelven datos de sources2.0 con latencia simulada.
 * Si es false, atacan los endpoints REST del backend.
 *
 * El consumidor recibe siempre `AirportWithCoords` (con lat/lng decimales)
 * para no tener que parsear DMS en cada componente.
 */

/**
 * Lista todos los aeropuertos del sistema.
 * Endpoint: GET /aeropuertos
 */
export const listAirports = async (): Promise<AirportWithCoords[]> => {
  const cachedAirports = getCachedAirports();
  if (cachedAirports.length > 0) {
    return cachedAirports;
  }

  try {
    await initializeReferenceData();
  } catch {
    // Si falla la precarga global, reintentamos solo aeropuertos.
  }

  const hydratedAirports = getCachedAirports();
  if (hydratedAirports.length > 0) {
    return hydratedAirports;
  }

  const airports = await fetchAllAirportsReferenceData();
  useReferenceDataStore.getState().setAirports(airports);
  return airports;
};

/**
 * Obtiene el detalle de un aeropuerto por su codigo ICAO.
 * Endpoint: GET /aeropuertos/{icao}
 */
export const getAirportByIcao = async (
  icao: string
): Promise<AirportWithCoords | null> => {
  const cachedAirport = getCachedAirportByIcao(icao);
  if (cachedAirport) {
    return cachedAirport;
  }

  const airports = await listAirports();
  return airports.find((airport) => airport.icao === icao) ?? null;
};
