import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import { AIRPORTS_MOCK } from "@/services/sources2.0/airports.mock";
import { USE_MOCK_DATA } from "@/utils/constants";
import { parseAirportsList } from "@/utils/airportHelpers";
import type { Airport, AirportWithCoords } from "@/types/airport.types";

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
  if (USE_MOCK_DATA) {
    const data = await mockResolve<Airport[]>(AIRPORTS_MOCK);
    return parseAirportsList(data);
  }
  const { data } = await api.get<Airport[]>("/aeropuertos");
  return parseAirportsList(data);
};

/**
 * Obtiene el detalle de un aeropuerto por su codigo ICAO.
 * Endpoint: GET /aeropuertos/{icao}
 */
export const getAirportByIcao = async (
  icao: string
): Promise<AirportWithCoords | null> => {
  if (USE_MOCK_DATA) {
    const found = AIRPORTS_MOCK.find((a) => a.icao === icao);
    if (!found) return mockResolve<AirportWithCoords | null>(null);
    return mockResolve<AirportWithCoords | null>(parseAirportsList([found])[0]);
  }
  try {
    const { data } = await api.get<Airport>(`/aeropuertos/${icao}`);
    return parseAirportsList([data])[0];
  } catch {
    return null;
  }
};
