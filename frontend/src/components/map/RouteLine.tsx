import { useMemo } from "react";
import L from "leaflet";
import { Polyline, useMap } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import { COLORS } from "@/styles/theme";

interface RouteLineProps {
  from: AirportWithCoords;
  to: AirportWithCoords;
  /** Avance del vuelo entre 0 y 1. */
  progress: number;
  /** Dibuja el segmento completo, util para rutas de envios. */
  full?: boolean;
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
const RouteLine = ({
  from,
  to,
  progress,
  full = false,
  color = COLORS.text.secondary,
}: RouteLineProps) => {
  const map = useMap();

  const positions = useMemo(() => {
    if (full) {
      return [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ] as [number, number][];
    }

    if (progress <= 0 || progress >= 1) {
      return null;
    }

    const fromLatLng: [number, number] = [from.lat, from.lng];
    const toLatLng: [number, number] = [to.lat, to.lng];

    const fromPx = map.project(fromLatLng, 0);
    const toPx = map.project(toLatLng, 0);

    const currentPx = L.point(
      fromPx.x + (toPx.x - fromPx.x) * progress,
      fromPx.y + (toPx.y - fromPx.y) * progress
    );
    const currentPosition = map.unproject(currentPx, 0);

    return [
      [currentPosition.lat, currentPosition.lng],
      [to.lat, to.lng],
    ] as [number, number][];
  }, [from.lat, from.lng, full, map, progress, to.lat, to.lng]);

  if (!positions) {
    return null;
  }

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight: 2,
        opacity: 0.7,
        dashArray: "6 8",
      }}
    />
  );
};

export default RouteLine;
