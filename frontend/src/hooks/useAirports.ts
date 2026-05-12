import { useEffect } from "react";
import {
  initializeReferenceData,
  useReferenceDataStore,
} from "@/store/referenceDataStore";
import type { AirportWithCoords } from "@/types/airport.types";

/**
 * Estado que devuelve el hook de aeropuertos.
 */
interface UseAirportsResult {
  airports: AirportWithCoords[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook que carga la lista de aeropuertos del sistema.
 *
 * Reemplaza el patron `useMemo + parseAirportsList(AIRPORTS_MOCK)`
 * que estaba duplicado en cada pagina de la entrega B. Ahora la fuente
 * de datos pasa por el servicio (airportService), asi que cuando el
 * backend este listo solo se cambia VITE_USE_MOCK=false y nada mas.
 *
 * Devuelve un array vacio mientras isLoading=true para que los
 * componentes consumidores no necesiten manejar undefined.
 */
export const useAirports = (): UseAirportsResult => {
  const airports = useReferenceDataStore((s) => s.airports);
  const isLoading = useReferenceDataStore((s) => s.isLoading);
  const error = useReferenceDataStore((s) => s.error);

  useEffect(() => {
    void initializeReferenceData();
  }, []);

  return { airports, isLoading, error };
};
