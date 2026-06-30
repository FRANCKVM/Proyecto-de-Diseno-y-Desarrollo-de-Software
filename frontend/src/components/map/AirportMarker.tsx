import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo } from "@/types/common.types";
import { ESTADO_COLOR_HEX } from "@/utils/airportHelpers";
import { AIRPORT_MARKER, COLORS } from "@/styles/theme";

interface AirportMarkerProps {
  airport: AirportWithCoords;
  estado: EstadoSemaforo;
  /** Porcentaje de ocupacion (0-100), mostrado bajo el codigo ICAO. */
  ocupacion?: number;
  selected?: boolean;
  onClick?: (airport: AirportWithCoords) => void;
}

const WAREHOUSE_PATHS = `
  <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
  <path d="M6 18h12"/>
  <path d="M6 14h12"/>
  <rect width="12" height="12" x="6" y="10"/>
`;

/**
 * Construye el HTML del divIcon con halo semaforo + icono de almacen
 * logistico y la etiqueta debajo.
 *
 * El halo conserva el estado de ocupacion. El icono evita que el
 * aeropuerto se lea como un punto generico en el mapa.
 */
const buildIconHtml = (
  icao: string,
  color: string,
  ocupacion?: number,
  selected = false
): string => {
  const { glow, ring } = AIRPORT_MARKER;
  const totalSize = glow.size; // ancho del SVG
  const center = totalSize / 2;
  const ocupacionLabel =
    ocupacion !== undefined
      ? `<span class="tasf-airport-pct">${Math.round(ocupacion)}%</span>`
      : "";

  return `
    <div class="tasf-airport-marker" style="${selected ? "transform: scale(1.12);" : ""}">
      <svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg">
        ${
          selected
            ? `<circle cx="${center}" cy="${center}" r="${glow.size / 2 - 2}" fill="none" stroke="${COLORS.primary.base}" stroke-width="3" opacity="0.95"/>`
            : ""
        }
        <circle cx="${center}" cy="${center}" r="${glow.size / 2}" fill="${color}" opacity="${glow.opacity}"/>
        <circle cx="${center}" cy="${center}" r="${ring.size / 2}" fill="${color}" opacity="${ring.opacity}"/>
        <circle cx="${center}" cy="${center}" r="10" fill="${COLORS.background.card}" stroke="${color}" stroke-width="2"/>
        <g transform="translate(${center - 7} ${center - 7}) scale(0.58)"
           fill="none" stroke="${COLORS.text.primary}" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round">
          ${WAREHOUSE_PATHS}
        </g>
      </svg>
      <span class="tasf-airport-label" style="${selected ? `background:${COLORS.primary.base}; color:${COLORS.text.inverse}; padding:1px 5px; border-radius:6px;` : ""}">${icao}</span>
      ${ocupacionLabel}
    </div>
  `;
};

/**
 * Marcador de aeropuerto en el mapa.
 *
 * Halo semaforo + icono de almacen logistico.
 * Etiqueta debajo con codigo ICAO + porcentaje en color text-primary.
 */
const AirportMarker = ({
  airport,
  estado,
  ocupacion,
  selected = false,
  onClick,
}: AirportMarkerProps) => {
  const color = ESTADO_COLOR_HEX[estado];

  // Memoizamos el icono porque crear divIcon en cada render reinstancia
  // el DOM del marker y mata la performance con muchos aeropuertos.
  const icon = useMemo(
    () =>
      L.divIcon({
        html: buildIconHtml(airport.icao, color, ocupacion, selected),
        className: "", // anula el estilo por defecto de leaflet-div-icon
        iconSize: [60, 50],
        iconAnchor: [30, 14], // centro de la SVG sobre el lat/lng
      }),
    [airport.icao, color, ocupacion, selected]
  );

  return (
    <Marker
      position={[airport.lat, airport.lng]}
      icon={icon}
      riseOnHover
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{
        click: () => onClick?.(airport),
      }}
    />
  );
};

export default AirportMarker;
