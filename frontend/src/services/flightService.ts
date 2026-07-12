import {
  fetchFlightsByAirportReferenceData,
  fetchFlightOccurrenceDetail,
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

const occurrenceListCache = new Map<string, { expiresAt: number; data: VueloDetalle[] }>();
const occurrenceListRequests = new Map<string, Promise<VueloDetalle[]>>();

const occurrenceContextPrefix = (idSimulacion?: number | null) =>
  idSimulacion != null ? `sim:${idSimulacion}` : "operation";

const occurrenceContextKey = (idSimulacion?: number | null, fecha?: string) =>
  `${occurrenceContextPrefix(idSimulacion)}:${fecha ?? "actual"}`;

const ISO_WITH_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export const resolveFlightQueryDate = (
  idSimulacion?: number | null,
  simulationStart?: string | null,
  referenceMinute?: number | null
): string => {
  if (idSimulacion != null && simulationStart) {
    const normalizedStart = ISO_WITH_TIME_ZONE.test(simulationStart)
      ? simulationStart
      : `${simulationStart}Z`;
    const startMs = Date.parse(normalizedStart);
    if (Number.isFinite(startMs)) {
      return new Date(startMs + Math.max(0, referenceMinute ?? 0) * 60_000)
        .toISOString()
        .slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
};

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
 * Obtiene el detalle de una ocurrencia por su identificador visual `occ-{id}`.
 * Endpoint: GET /vuelos/ocurrencias/{idOcurrencia}
 */
export const getFlightByCode = async (
  codigo: string,
  idSimulacion?: number | null,
  options?: { forceRefresh?: boolean }
): Promise<VueloDetalle | null> => {
  if (!codigo.startsWith("occ-")) return null;
  const idOcurrencia = Number(codigo.slice(4));
  if (!Number.isFinite(idOcurrencia)) return null;
  const cached = options?.forceRefresh || idSimulacion != null ? null : getCachedFlightByCode(codigo);
  if (cached) return cached;
  const occurrence = await fetchFlightOccurrenceDetail(idOcurrencia, idSimulacion);
  if (occurrence && idSimulacion == null) cacheFlightDetail(occurrence);
  return occurrence;
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
  options?: { forceRefresh?: boolean; fecha?: string }
): Promise<VueloDetalle[]> => {
  if (idSimulacion != null) {
    return fetchFlightsByAirportReferenceData(icao, idSimulacion, options?.fecha);
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

  const flights = await fetchFlightsByAirportReferenceData(
    icao,
    undefined,
    options?.fecha
  );
  cacheFlightsForAirport(icao, flights);
  return flights;
};

export const cancelFlightOccurrence = async (
  idOcurrencia: number,
  idSimulacion?: number | null
): Promise<VueloDetalle> => {
  const { data } = await api.post<VueloDetalle>(`/vuelos/ocurrencias/${idOcurrencia}/cancelar`, {
    idSimulacion: idSimulacion ?? null,
  });

  cacheFlightDetail(data);
  const prefix = `${occurrenceContextPrefix(idSimulacion)}:`;
  for (const key of occurrenceListCache.keys()) {
    if (key.startsWith(prefix)) occurrenceListCache.delete(key);
  }
  return data;
};

export const listFlightOccurrences = async (
  idSimulacion?: number | null,
  fecha?: string
): Promise<VueloDetalle[]> => {
  const key = occurrenceContextKey(idSimulacion, fecha);
  const cached = occurrenceListCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const pending = occurrenceListRequests.get(key);
  if (pending) return pending;

  const request = api.get<VueloDetalle[]>("/vuelos/ocurrencias", {
      params: {
        ...(idSimulacion != null ? { idSimulacion } : {}),
        ...(fecha ? { fecha } : {}),
      },
    })
    .then(({ data }) => {
      occurrenceListCache.set(key, {
        data,
        expiresAt: Date.now() + (idSimulacion != null ? 2_000 : 30_000),
      });
      return data;
    })
    .finally(() => occurrenceListRequests.delete(key));
  occurrenceListRequests.set(key, request);
  return request;
};
