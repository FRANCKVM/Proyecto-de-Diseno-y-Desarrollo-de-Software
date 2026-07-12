import { create } from "zustand";
import {
  fetchAllAirportsReferenceData,
} from "@/services/referenceDataService";
import type { AirportWithCoords } from "@/types/airport.types";
import type { VueloDetalle } from "@/types/flight.types";

interface ReferenceDataState {
  airports: AirportWithCoords[];
  airportsByIcao: Record<string, AirportWithCoords>;
  flightsByCode: Record<string, VueloDetalle>;
  flightCodesByAirport: Record<string, string[]>;
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
  setLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  setInitialized: (isInitialized: boolean) => void;
  setAirports: (airports: AirportWithCoords[]) => void;
  cacheFlightsForAirport: (icao: string, flights: VueloDetalle[]) => void;
  cacheFlightDetail: (flight: VueloDetalle) => void;
}

const unique = (values: string[]) => Array.from(new Set(values));
const flightCacheKey = (flight: VueloDetalle): string =>
  `occ:${flight.idOcurrencia}`;

export const useReferenceDataStore = create<ReferenceDataState>((set) => ({
  airports: [],
  airportsByIcao: {},
  flightsByCode: {},
  flightCodesByAirport: {},
  isLoading: false,
  isInitialized: false,
  error: null,
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setAirports: (airports) =>
    set({
      airports,
      airportsByIcao: Object.fromEntries(
        airports.map((airport) => [airport.icao, airport])
      ),
    }),
  cacheFlightsForAirport: (icao, flights) =>
    set((state) => {
      const nextFlightsByCode = { ...state.flightsByCode };

      for (const flight of flights) {
        nextFlightsByCode[flightCacheKey(flight)] = flight;
      }

      return {
        flightsByCode: nextFlightsByCode,
        flightCodesByAirport: {
          ...state.flightCodesByAirport,
          [icao]: unique(flights.map(flightCacheKey)),
        },
      };
    }),
  cacheFlightDetail: (flight) =>
    set((state) => ({
      flightsByCode: {
        ...state.flightsByCode,
        [flightCacheKey(flight)]: flight,
      },
      flightCodesByAirport: {
        ...state.flightCodesByAirport,
        [flight.origenIcao]: unique([
          ...(state.flightCodesByAirport[flight.origenIcao] ?? []),
          flightCacheKey(flight),
        ]),
        [flight.destinoIcao]: unique([
          ...(state.flightCodesByAirport[flight.destinoIcao] ?? []),
          flightCacheKey(flight),
        ]),
      },
    })),
}));

let initializationPromise: Promise<void> | null = null;

export const getCachedAirports = () => useReferenceDataStore.getState().airports;

export const getCachedAirportByIcao = (icao: string) =>
  useReferenceDataStore.getState().airportsByIcao[icao] ?? null;

export const hasCachedFlightsByAirport = (icao: string) =>
  Object.prototype.hasOwnProperty.call(
    useReferenceDataStore.getState().flightCodesByAirport,
    icao
  );

export const getCachedFlightsByAirport = (icao: string): VueloDetalle[] => {
  const state = useReferenceDataStore.getState();
  const codes = state.flightCodesByAirport[icao] ?? [];
  return codes
    .map((code) => state.flightsByCode[code])
    .filter((flight): flight is VueloDetalle => Boolean(flight));
};

export const getCachedFlightByCode = (codigo: string) => {
  const key = codigo.startsWith("occ-")
    ? `occ:${codigo.slice(4)}`
    : codigo;
  const state = useReferenceDataStore.getState();
  return state.flightsByCode[key]
    ?? Object.values(state.flightsByCode).find((flight) => flight.codigo === codigo)
    ?? null;
};

export const cacheFlightsForAirport = (icao: string, flights: VueloDetalle[]) =>
  useReferenceDataStore.getState().cacheFlightsForAirport(icao, flights);

export const cacheFlightDetail = (flight: VueloDetalle) =>
  useReferenceDataStore.getState().cacheFlightDetail(flight);

export const initializeReferenceData = async (): Promise<void> => {
  const state = useReferenceDataStore.getState();

  if (state.isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const store = useReferenceDataStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const airports = await fetchAllAirportsReferenceData();
      useReferenceDataStore.getState().setAirports(airports);

      useReferenceDataStore.getState().setInitialized(true);
    } catch (error) {
      useReferenceDataStore
        .getState()
        .setError(
          error instanceof Error
            ? error
            : new Error("No se pudieron cargar los datos base del sistema.")
        );
      throw error;
    } finally {
      useReferenceDataStore.getState().setLoading(false);
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};
