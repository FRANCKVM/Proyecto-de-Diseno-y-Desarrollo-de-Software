/**
 * Tipos del dominio de aeropuertos.
 *
 * El tipo `Airport` se define en el mock para mantener fidelidad con el
 * schema del backend. Aqui se reexporta y se extiende con coordenadas
 * decimales pre-parseadas, que es lo que consumen los componentes del mapa.
 */

import type { Airport } from "@/services/sources2.0/airports.mock";

export type { Airport };

/**
 * Aeropuerto con coordenadas decimales listas para Leaflet.
 * Producto de aplicar `parseAirportCoords` sobre un `Airport`.
 */
export interface AirportWithCoords extends Airport {
  /** Continente o region operativa cuando viene del backend. */
  region?: string;
  /** Latitud decimal. Negativa para hemisferio sur. */
  lat: number;
  /** Longitud decimal. Negativa para hemisferio oeste. */
  lng: number;
}
