import { useEffect, useState } from "react";
import { listAirports } from "@/services/airportService";
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
  const [airports, setAirports] = useState<AirportWithCoords[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAirports()
      .then((data) => {
        if (!cancelled) {
          setAirports(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { airports, isLoading, error };
};
