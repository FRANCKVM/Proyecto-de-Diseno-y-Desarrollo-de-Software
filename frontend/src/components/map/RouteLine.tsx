import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Marker, Polyline, useMap } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import { COLORS } from "@/styles/theme";

interface RouteLineProps {
  from: AirportWithCoords;
  to: AirportWithCoords;
  /** Avance del vuelo entre 0 y 1. */
  progress: number;
  progressVelocityPerSecond?: number;
  progressUpdatedAtMs?: number;
  /** Dibuja el segmento completo, util para rutas de envios. */
  full?: boolean;
  /**
   * Color del trazo. Por defecto gris secundario del estandar,
   * que se distingue claramente sobre el fondo claro de CartoDB
   * Positron sin saturar la vista.
   */
  color?: string;
  /** Muestra una punta sobre el segmento para indicar direccion. */
  directional?: boolean;
}

const ROUTE_ARROW_SIZE = 18;
const REF_ZOOM = 0;

const buildRouteArrowHtml = (color: string, angle: number): string => `
  <div class="tasf-route-arrow" style="--tasf-route-arrow-color:${color}; transform: rotate(${angle}deg);">
    <svg width="${ROUTE_ARROW_SIZE}" height="${ROUTE_ARROW_SIZE}" viewBox="0 0 18 18"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 9H12.5" />
      <path d="M9 5L13 9L9 13" />
    </svg>
  </div>
`;

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
  progressVelocityPerSecond,
  progressUpdatedAtMs,
  full = false,
  color = COLORS.text.secondary,
  directional = false,
}: RouteLineProps) => {
  const map = useMap();
  const polylineRef = useRef<L.Polyline | null>(null);

  const { positions, fromPx, toPx, arrowPosition, arrowAngle } = useMemo(() => {
    const fromLatLng: [number, number] = [from.lat, from.lng];
    const toLatLng: [number, number] = [to.lat, to.lng];
    const fromPx = map.project(fromLatLng, REF_ZOOM);
    const toPx = map.project(toLatLng, REF_ZOOM);
    const angle = (Math.atan2(toPx.y - fromPx.y, toPx.x - fromPx.x) * 180) / Math.PI;
    const arrowPx = L.point(
      fromPx.x + (toPx.x - fromPx.x) * 0.62,
      fromPx.y + (toPx.y - fromPx.y) * 0.62
    );
    const arrowLatLng = map.unproject(arrowPx, REF_ZOOM);

    if (full) {
      return {
        positions: [
          [from.lat, from.lng],
          [to.lat, to.lng],
        ] as [number, number][],
        fromPx,
        toPx,
        arrowPosition: [arrowLatLng.lat, arrowLatLng.lng] as [number, number],
        arrowAngle: angle,
      };
    }

    if (progress <= 0 || progress >= 1) {
      return {
        positions: null,
        fromPx,
        toPx,
        arrowPosition: [arrowLatLng.lat, arrowLatLng.lng] as [number, number],
        arrowAngle: angle,
      };
    }

    const currentPx = L.point(
      fromPx.x + (toPx.x - fromPx.x) * progress,
      fromPx.y + (toPx.y - fromPx.y) * progress
    );
    const currentPosition = map.unproject(currentPx, 0);

    return {
      positions: [
        [currentPosition.lat, currentPosition.lng],
        [to.lat, to.lng],
      ] as [number, number][],
      fromPx,
      toPx,
      arrowPosition: [arrowLatLng.lat, arrowLatLng.lng] as [number, number],
      arrowAngle: angle,
    };
  }, [from.lat, from.lng, full, map, progress, to.lat, to.lng]);
  const progressSnapshot = progress;
  const progressTimestamp = progressUpdatedAtMs ?? performance.now();
  const progressVelocity = progressVelocityPerSecond ?? 0;

  useEffect(() => {
    if (full || !positions) {
      return;
    }

    const polyline = polylineRef.current;
    if (!polyline) {
      return;
    }

    let rafId = 0;

    const setLinePositions = (nextProgress: number) => {
      const clampedProgress = Math.max(0, Math.min(1, nextProgress));
      const currentPx = L.point(
        fromPx.x + (toPx.x - fromPx.x) * clampedProgress,
        fromPx.y + (toPx.y - fromPx.y) * clampedProgress
      );
      const currentPosition = map.unproject(currentPx, 0);

      polyline.setLatLngs([
        [currentPosition.lat, currentPosition.lng],
        [to.lat, to.lng],
      ]);
    };

    const tick = (now: number) => {
      const elapsedSeconds = (now - progressTimestamp) / 1000;
      const nextProgress =
        progressSnapshot + elapsedSeconds * progressVelocity;

      setLinePositions(nextProgress);

      if (nextProgress < 1 && progressVelocity > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    setLinePositions(progressSnapshot);

    if (progressSnapshot < 1 && progressVelocity > 0) {
      rafId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(rafId);
  }, [
    fromPx.x,
    fromPx.y,
    full,
    map,
    positions,
    progressSnapshot,
    progressTimestamp,
    progressVelocity,
    to.lat,
    to.lng,
    toPx.x,
    toPx.y,
  ]);

  if (!positions) {
    return null;
  }

  const arrowIcon =
    directional && arrowPosition
      ? L.divIcon({
          html: buildRouteArrowHtml(color, arrowAngle),
          className: "",
          iconSize: [ROUTE_ARROW_SIZE, ROUTE_ARROW_SIZE],
          iconAnchor: [ROUTE_ARROW_SIZE / 2, ROUTE_ARROW_SIZE / 2],
        })
      : null;

  return (
    <Fragment>
      <Polyline
        ref={polylineRef}
        positions={positions}
        pathOptions={{
          color,
          weight: directional ? 2 : 1,
          opacity: 0.7,
          dashArray: "6 8",
        }}
      />
      {arrowIcon && (
        <Marker
          position={arrowPosition}
          icon={arrowIcon}
          interactive={false}
          keyboard={false}
          zIndexOffset={500}
        />
      )}
    </Fragment>
  );
};

export default RouteLine;
