import { Polyline } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import { COLORS } from "@/styles/theme";

interface RouteLineProps {
  from: AirportWithCoords;
  to: AirportWithCoords;
  /**
   * Color del trazo. Por defecto gris secundario del estandar,
   * que se distingue claramente sobre el fondo claro de CartoDB
   * Positron sin saturar la vista.
   */
  color?: string;
}

/**
 * Linea punteada que representa una ruta entre dos aeropuertos.
 *
 * Estandar 61, seccion 4.7: rutas como lineas dashed sobre el mapa.
 * El badge de cantidad de maletas en transito (visible en los mockups
 * 03 y 09) se renderiza en una capa aparte cuando llegue el motor de
 * simulacion en la entrega C; aqui solo va la linea base.
 */
const RouteLine = ({ from, to, color = COLORS.text.secondary }: RouteLineProps) => (
  <Polyline
    positions={[
      [from.lat, from.lng],
      [to.lat, to.lng],
    ]}
    pathOptions={{
      color,
      weight: 2,
      opacity: 0.7,
      dashArray: "6 8",
    }}
  />
);

export default RouteLine;
