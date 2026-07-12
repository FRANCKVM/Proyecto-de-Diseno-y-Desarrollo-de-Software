import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import { AIRPORTS_MOCK } from "@/services/sources2.0/airports.mock";
import { VUELOS_DETALLE_MOCK } from "@/services/sources2.0/flightsDetail.mock";
import { USE_MOCK_DATA } from "@/utils/constants";
import { parseAirportsList } from "@/utils/airportHelpers";
import type { Airport, AirportWithCoords } from "@/types/airport.types";
import type { BackendAeropuerto } from "@/types/backendSimulation.types";
import type { VueloDetalle } from "@/types/flight.types";

const mapBackendAirport = (airport: BackendAeropuerto): AirportWithCoords => ({
  id: airport.codigo,
  icao: airport.codigo,
  name: airport.ciudad,
  country: airport.pais,
  region: airport.region,
  cityCode: airport.codigo,
  gmt: airport.desplazamientoGMT,
  capacity: airport.capacidad,
  latDMS: "",
  lngDMS: "",
  lat: airport.latitud ?? 0,
  lng: airport.longitud ?? 0,
});

export const fetchAllAirportsReferenceData = async (): Promise<
  AirportWithCoords[]
> => {
  if (USE_MOCK_DATA) {
    const data = await mockResolve<Airport[]>(AIRPORTS_MOCK);
    return parseAirportsList(data);
  }

  const { data } = await api.get<BackendAeropuerto[]>("/aeropuertos");
  return data.map(mapBackendAirport);
};

export const fetchFlightsByAirportReferenceData = async (
  icao: string,
  idSimulacion?: number | null,
  fecha?: string
): Promise<VueloDetalle[]> => {
  if (USE_MOCK_DATA) {
    const filtered = VUELOS_DETALLE_MOCK.filter(
      (v) => v.origenIcao === icao || v.destinoIcao === icao
    );
    return mockResolve<VueloDetalle[]>(filtered);
  }

  const { data } = await api.get<VueloDetalle[]>(`/aeropuertos/${icao}/vuelos`, {
    params: {
      ...(idSimulacion != null ? { idSimulacion } : {}),
      ...(fecha ? { fecha } : {}),
    },
  });
  return data;
};

export const fetchFlightOccurrenceDetail = async (
  idOcurrencia: number,
  idSimulacion?: number | null
): Promise<VueloDetalle | null> => {
  try {
    const { data } = await api.get<VueloDetalle>(
      `/vuelos/ocurrencias/${idOcurrencia}`,
      { params: idSimulacion != null ? { idSimulacion } : undefined }
    );
    return data;
  } catch {
    return null;
  }
};
