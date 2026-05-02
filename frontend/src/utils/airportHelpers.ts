/**
 * Helpers del dominio de aeropuertos.
 * Parseo de coordenadas y derivacion de estado del semaforo.
 */

import type { Airport, AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";
import { dmsToDecimal } from "@/utils/geoUtils";
import {
  UMBRAL_SEMAFORO_VERDE_DEFAULT,
  UMBRAL_SEMAFORO_AMBAR_DEFAULT,
} from "@/utils/constants";
import { COLORS } from "@/styles/theme";

/**
 * Convierte un Airport (con coords DMS) en AirportWithCoords (decimales).
 * Lanza Error si las coords no tienen formato DMS valido.
 */
export const parseAirportCoords = (a: Airport): AirportWithCoords => ({
  ...a,
  lat: dmsToDecimal(a.latDMS),
  lng: dmsToDecimal(a.lngDMS),
});

/**
 * Aplica parseAirportCoords a una lista. Util para transformar el mock entero.
 */
export const parseAirportsList = (airports: Airport[]): AirportWithCoords[] =>
  airports.map(parseAirportCoords);

/**
 * Determina el estado del semaforo a partir del porcentaje de ocupacion.
 *
 * @param ocupacion Porcentaje entre 0 y 100.
 * @param rangos    Umbrales personalizados; por defecto usa los del estandar.
 */
export const getEstadoSemaforo = (
  ocupacion: number,
  rangos: RangoSemaforo = {
    verde: UMBRAL_SEMAFORO_VERDE_DEFAULT,
    ambar: UMBRAL_SEMAFORO_AMBAR_DEFAULT,
  }
): EstadoSemaforo => {
  if (ocupacion < rangos.verde) return "normal";
  if (ocupacion < rangos.ambar) return "elevado";
  return "critico";
};

/**
 * Mapea el estado de semaforo a su color hex semantico.
 * Usado por componentes de mapa (Leaflet) que requieren color en JS,
 * no en clases CSS.
 */
export const ESTADO_COLOR_HEX: Record<EstadoSemaforo, string> = {
  normal: COLORS.success.base,
  elevado: COLORS.warning.base,
  critico: COLORS.danger.base,
};
