import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo } from "@/types/common.types";
import { ESTADO_COLOR_HEX } from "@/utils/airportHelpers";
import { AIRPORT_MARKER } from "@/styles/theme";

interface AirportMarkerProps {
  airport: AirportWithCoords;
  estado: EstadoSemaforo;
  /** Porcentaje de ocupacion (0-100), mostrado bajo el codigo ICAO. */
  ocupacion?: number;
  onClick?: (airport: AirportWithCoords) => void;
}

/**
 * Construye el HTML del divIcon con los tres circulos concentricos
 * del estandar 61 (seccion 4.6) y la etiqueta debajo.
 *
 * El color de los circulos varia por estado de semaforo.
 * El color del texto es uniforme (text-primary del estandar) para
 * legibilidad nativa sobre el mapa claro CartoDB Positron.
 */
const buildIconHtml = (
  icao: string,
  color: string,
  ocupacion?: number
): string => {
  const { glow, ring, core } = AIRPORT_MARKER;
  const totalSize = glow.size; // ancho del SVG
  const center = totalSize / 2;
  const ocupacionLabel =
    ocupacion !== undefined
      ? `<span class="tasf-airport-pct">${Math.round(ocupacion)}%</span>`
      : "";

  return `
    <div class="tasf-airport-marker">
      <svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${center}" cy="${center}" r="${glow.size / 2}" fill="${color}" opacity="${glow.opacity}"/>
        <circle cx="${center}" cy="${center}" r="${ring.size / 2}" fill="${color}" opacity="${ring.opacity}"/>
        <circle cx="${center}" cy="${center}" r="${core.size / 2}" fill="${color}" opacity="${core.opacity}"/>
      </svg>
      <span class="tasf-airport-label">${icao}</span>
      ${ocupacionLabel}
    </div>
  `;
};

/**
 * Marcador de aeropuerto en el mapa.
 *
 * Estandar 61, seccion 4.6: tres circulos concentricos (glow, ring, core)
 * con opacidades 0.15 / 0.35 / 1, color segun estado de semaforo.
 * Etiqueta debajo con codigo ICAO + porcentaje en color text-primary.
 */
const AirportMarker = ({
  airport,
  estado,
  ocupacion,
  onClick,
}: AirportMarkerProps) => {
  const color = ESTADO_COLOR_HEX[estado];

  // Memoizamos el icono porque crear divIcon en cada render reinstancia
  // el DOM del marker y mata la performance con muchos aeropuertos.
  const icon = useMemo(
    () =>
      L.divIcon({
        html: buildIconHtml(airport.icao, color, ocupacion),
        className: "", // anula el estilo por defecto de leaflet-div-icon
        iconSize: [60, 50],
        iconAnchor: [30, 14], // centro de la SVG sobre el lat/lng
      }),
    [airport.icao, color, ocupacion]
  );

  return (
    <Marker
      position={[airport.lat, airport.lng]}
      icon={icon}
      riseOnHover
      eventHandlers={{
        click: () => onClick?.(airport),
      }}
    />
  );
};

export default AirportMarker;
