import { create } from "zustand";
import { fetchAllAirportsReferenceData, fetchFlightDetailReferenceData, fetchFlightsByAirportReferenceData } from "@/services/referenceDataService";
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
        nextFlightsByCode[flight.codigo] = flight;
      }

      return {
        flightsByCode: nextFlightsByCode,
        flightCodesByAirport: {
          ...state.flightCodesByAirport,
          [icao]: unique(flights.map((flight) => flight.codigo)),
        },
      };
    }),
  cacheFlightDetail: (flight) =>
    set((state) => ({
      flightsByCode: {
        ...state.flightsByCode,
        [flight.codigo]: flight,
      },
      flightCodesByAirport: {
        ...state.flightCodesByAirport,
        [flight.origenIcao]: unique([
          ...(state.flightCodesByAirport[flight.origenIcao] ?? []),
          flight.codigo,
        ]),
        [flight.destinoIcao]: unique([
          ...(state.flightCodesByAirport[flight.destinoIcao] ?? []),
          flight.codigo,
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

export const getCachedFlightByCode = (codigo: string) =>
  useReferenceDataStore.getState().flightsByCode[codigo] ?? null;

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

      const flightResults = await Promise.allSettled(
        airports.map(async (airport) => ({
          icao: airport.icao,
          flights: await fetchFlightsByAirportReferenceData(airport.icao),
        }))
      );

      const failedAirports: string[] = [];

      for (const result of flightResults) {
        if (result.status === "fulfilled") {
          useReferenceDataStore
            .getState()
            .cacheFlightsForAirport(result.value.icao, result.value.flights);
          continue;
        }

        const reason = result.reason;
        failedAirports.push(
          reason instanceof Error ? reason.message : "Error al cargar vuelos."
        );
      }

      if (failedAirports.length > 0) {
        useReferenceDataStore
          .getState()
          .setError(
            new Error(
              "Se cargaron los datos base, pero algunos vuelos no pudieron precargarse."
            )
          );
      }

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

export const ensureFlightDetailCached = async (
  codigo: string
): Promise<VueloDetalle | null> => {
  const cached = getCachedFlightByCode(codigo);
  if (cached) {
    return cached;
  }

  const flight = await fetchFlightDetailReferenceData(codigo);
  if (flight) {
    cacheFlightDetail(flight);
  }
  return flight;
};
