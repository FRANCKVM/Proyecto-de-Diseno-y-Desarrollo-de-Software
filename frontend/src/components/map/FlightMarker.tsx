import { useMemo } from "react";
import L from "leaflet";
import { Marker, useMap } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo } from "@/types/common.types";
import { ESTADO_COLOR_HEX } from "@/utils/airportHelpers";
import { COLORS } from "@/styles/theme";

interface FlightMarkerProps {
  flightId: string;
  fromAirport: AirportWithCoords;
  toAirport: AirportWithCoords;
  /** Avance del vuelo entre 0 y 1. */
  progress: number;
  /**
   * Color del avion segun estado del semaforo del vuelo.
   * Si no se provee, se pinta en text-primary (oscuro), el patron por
   * defecto sobre el mapa claro de CartoDB Positron.
   */
  estado?: EstadoSemaforo;
  onClick?: (flightId: string) => void;
}

/**
 * Tamano del icono de avion. Estandar 61: rango 18-24px.
 * 22px destaca sobre el core del aeropuerto (10px) sin tapar el mapa.
 */
const PLANE_SIZE = 22;

/**
 * Zoom de referencia para los calculos de proyeccion.
 * Cualquier valor produce el mismo resultado relativo, pero usar 0
 * mantiene los numeros pequenos y legibles si se debuggea.
 */
const REF_ZOOM = 0;

/**
 * Offset de orientacion del icono SVG.
 *
 * El path de lucide-react `Plane` apunta naturalmente hacia el
 * cuadrante NORESTE (~45 grados desde el norte), no al norte puro
 * como cabria esperar. Compensamos restando 45 al bearing geodesico
 * para que el avion termine apuntando hacia donde realmente vuela.
 *
 * Si en el futuro se reemplaza el icono por un asset que apunte al
 * norte puro, basta con cambiar este valor a 0.
 */
const ICON_BEARING_OFFSET = -45;

/**
 * Path SVG del icono de avion (lucide-react `Plane`).
 *
 * Hardcodeado para evitar el costo de renderToString sobre el componente
 * React de lucide en cada actualizacion del divIcon. Cuando el icono
 * cambie en lucide, basta con copiar el nuevo path.
 */
const PLANE_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

/**
 * Construye el HTML del divIcon del avion.
 *
 * Sobre fondo claro (CartoDB Positron):
 *   - fill = color (oscuro por defecto, semaforo si se especifica)
 *   - stroke = blanco como halo de definicion (1.5px)
 *
 * La rotacion del bearing se aplica en el div contenedor para no
 * deformar el viewBox del SVG.
 */
const buildPlaneHtml = (color: string, displayBearing: number): string => `
  <div class="tasf-flight-marker" style="transform: rotate(${displayBearing}deg)">
    <svg width="${PLANE_SIZE}" height="${PLANE_SIZE}" viewBox="0 0 24 24"
         xmlns="http://www.w3.org/2000/svg"
         fill="${color}" stroke="#FFFFFF" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         paint-order="stroke fill">
      <path d="${PLANE_PATH}"/>
    </svg>
  </div>
`;

/**
 * Marcador de vuelo en transito.
 *
 * Calcula posicion y bearing en el espacio de proyeccion Mercator
 * (mismo que usa Polyline de Leaflet para dibujar las rutas), de modo
 * que el avion siempre cae exactamente sobre la linea visible y apunta
 * en la direccion visual del trayecto.
 *
 * El bearing geodesico se compone con ICON_BEARING_OFFSET para
 * compensar la orientacion natural del path SVG.
 */
const FlightMarker = ({
  flightId,
  fromAirport,
  toAirport,
  progress,
  estado,
  onClick,
}: FlightMarkerProps) => {
  const map = useMap();

  const { position, displayBearing } = useMemo(() => {
    const fromLatLng: [number, number] = [fromAirport.lat, fromAirport.lng];
    const toLatLng: [number, number] = [toAirport.lat, toAirport.lng];

    const fromPx = map.project(fromLatLng, REF_ZOOM);
    const toPx = map.project(toLatLng, REF_ZOOM);

    // Posicion: interpolacion lineal en pixeles Mercator.
    const midPx = L.point(
      fromPx.x + (toPx.x - fromPx.x) * progress,
      fromPx.y + (toPx.y - fromPx.y) * progress
    );
    const pos = map.unproject(midPx, REF_ZOOM);

    // Bearing geodesico: angulo de la linea en pixeles Mercator.
    // En coords de pantalla, +y apunta abajo (sur), +x apunta derecha (este).
    // atan2(dx, -dy) convierte ese sistema al convenio de bearing
    // (0 = norte, 90 = este, etc.).
    const dx = toPx.x - fromPx.x;
    const dy = toPx.y - fromPx.y;
    const geoBearing =
      ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;

    // Bearing visual: compensa el offset del path SVG para que el avion
    // apunte en la direccion correcta del trayecto.
    const display = (geoBearing + ICON_BEARING_OFFSET + 360) % 360;

    return {
      position: [pos.lat, pos.lng] as [number, number],
      displayBearing: display,
    };
  }, [
    map,
    fromAirport.lat,
    fromAirport.lng,
    toAirport.lat,
    toAirport.lng,
    progress,
  ]);

  const color = estado ? ESTADO_COLOR_HEX[estado] : COLORS.text.primary;

  const icon = useMemo(
    () =>
      L.divIcon({
        html: buildPlaneHtml(color, displayBearing),
        className: "",
        iconSize: [PLANE_SIZE, PLANE_SIZE],
        iconAnchor: [PLANE_SIZE / 2, PLANE_SIZE / 2],
      }),
    [color, displayBearing]
  );

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: () => onClick?.(flightId),
      }}
    />
  );
};

export default FlightMarker;
